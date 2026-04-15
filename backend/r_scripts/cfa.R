# ============================================================
# ScaleMind AI — CFA (Doğrulayıcı Faktör Analizi) R Scripti
# lavaan + semTools paketi
# ============================================================

library(lavaan)
library(semTools)
library(jsonlite)

# Input oku
input_json <- Sys.getenv("SCALEMIND_INPUT")
params     <- fromJSON(input_json, simplifyVector = FALSE)

data_list  <- params$data
model_spec <- params$model  # {factors: [{name, items}], correlatedFactors, estimator, lavaanSyntax}

# DataFrame - eşit uzunluk garantile
max_len <- max(sapply(data_list, length))
data_padded <- lapply(data_list, function(x) {
  x <- as.numeric(unlist(x))
  length(x) <- max_len
  x
})
df <- as.data.frame(data_padded)
df <- na.omit(df)
n  <- nrow(df)

warnings_list <- c()

# ------ Model Syntax ------
build_syntax <- function(spec) {
  lines <- c()
  for (fac in spec$factors) {
    items_str <- paste(unlist(fac$items), collapse = " + ")
    lines <- c(lines, paste0(fac$name, " =~ ", items_str))
  }
  if (!is.null(spec$correlatedFactors) && isTRUE(spec$correlatedFactors)) {
    factor_names <- sapply(spec$factors, function(f) f$name)
    if (length(factor_names) > 1) {
      for (i in seq_len(length(factor_names) - 1)) {
        for (j in seq(i + 1, length(factor_names))) {
          lines <- c(lines, paste0(factor_names[i], " ~~ ", factor_names[j]))
        }
      }
    }
  }
  paste(lines, collapse = "\n")
}

syntax <- if (!is.null(model_spec$lavaanSyntax) && nchar(model_spec$lavaanSyntax) > 0) {
  model_spec$lavaanSyntax
} else {
  build_syntax(model_spec)
}

# ------ Tahminleyici ------
estimator <- if (!is.null(model_spec$estimator)) toupper(model_spec$estimator) else "MLR"

# Küçük örneklem uyarısı
all_items <- unlist(lapply(model_spec$factors, function(f) f$items))
p <- length(all_items)
min_n <- 5 * p
if (n < min_n) {
  warnings_list <- c(warnings_list,
    paste0("Örneklem boyutu (n=", n, ") madde sayısının 5 katından küçük. ",
           "CFA sonuçları güvenilir olmayabilir. Önerilen: n≥", min_n))
}

# ------ CFA ------
fit <- tryCatch(
  cfa(syntax, data = df, estimator = estimator, std.lv = FALSE),
  error = function(e) {
    warnings_list <<- c(warnings_list, paste("CFA hatası:", e$message))
    NULL
  }
)

if (is.null(fit)) {
  cat(toJSON(list(
    success  = FALSE,
    error    = "Model tahmin edilemedi. Modeli kontrol edin.",
    syntax   = syntax,
    warnings = warnings_list
  ), auto_unbox = TRUE))
  quit(status = 0)
}

# ------ Uyum İndeksleri ------
fit_measures <- fitmeasures(fit, c(
  "chisq", "df", "pvalue",
  "cfi", "tli", "rmsea", "rmsea.ci.lower", "rmsea.ci.upper",
  "srmr", "gfi", "aic", "bic"
))
fm <- as.list(round(fit_measures, 4))
chi2df <- if (!is.null(fm$df) && fm$df > 0) round(fm$chisq / fm$df, 3) else NA

# Uyum yeterliliği
is_adequate <- (
  !is.na(fm$cfi) && fm$cfi >= 0.90 &&
  !is.na(fm$rmsea) && fm$rmsea <= 0.08 &&
  !is.na(fm$srmr) && fm$srmr <= 0.10
)

fit_summary <- if (is_adequate) {
  "Model uyumu kabul edilebilir düzeyde."
} else {
  problems <- c()
  if (!is.na(fm$cfi) && fm$cfi < 0.90) problems <- c(problems, paste0("CFI=", fm$cfi, " (<.90)"))
  if (!is.na(fm$rmsea) && fm$rmsea > 0.08) problems <- c(problems, paste0("RMSEA=", fm$rmsea, " (>.08)"))
  if (!is.na(fm$srmr) && fm$srmr > 0.10) problems <- c(problems, paste0("SRMR=", fm$srmr, " (>.10)"))
  paste("Model uyumu yetersiz:", paste(problems, collapse = "; "))
}

# ------ Faktör Yükleri ------
std_sol  <- standardizedSolution(fit)
loadings_df <- std_sol[std_sol$op == "=~", c("lhs", "rhs", "est.std", "se", "pvalue")]
colnames(loadings_df) <- c("factor", "item", "loading", "se", "pValue")
loadings_list <- lapply(seq_len(nrow(loadings_df)), function(i) {
  list(
    factor  = loadings_df$factor[i],
    item    = loadings_df$item[i],
    loading = round(loadings_df$loading[i], 3),
    se      = round(loadings_df$se[i], 3),
    pValue  = round(loadings_df$pValue[i], 4)
  )
})

# Düşük yük uyarısı
low_load <- loadings_df[!is.na(loadings_df$loading) & abs(loadings_df$loading) < 0.40, ]
if (nrow(low_load) > 0) {
  warnings_list <- c(warnings_list,
    paste0("Standardize yükü .40 altında olan maddeler: ",
           paste(low_load$item, collapse = ", "), ". Bu maddeler modeli zayıflatabilir."))
}

# ------ AVE ve CR (semTools) ------
ave_list <- list()
cr_list  <- list()
tryCatch({
  ave_vals <- AVE(fit)
  cr_vals  <- compRelSEM(fit)
  for (fac_name in names(ave_vals)) {
    ave_list[[fac_name]] <- round(as.numeric(ave_vals[fac_name]), 3)
  }
  for (fac_name in names(cr_vals)) {
    cr_list[[fac_name]] <- round(as.numeric(cr_vals[fac_name]), 3)
  }
}, error = function(e) {
  warnings_list <<- c(warnings_list, paste("AVE/CR hesaplanamadı:", e$message))
})

# AVE uyarısı
for (fac in names(ave_list)) {
  val <- ave_list[[fac]]
  if (!is.null(val) && !is.na(val) && val < 0.50) {
    warnings_list <- c(warnings_list,
      paste0("'", fac, "' faktörünün AVE değeri (", val, ") .50 altında — yakınsak geçerlilik zayıf."))
  }
}

# ------ Modifikasyon İndeksleri ------
mi_res <- tryCatch(modificationIndices(fit, sort. = TRUE, maximum.number = 10), error = function(e) NULL)
mi_list <- list()
if (!is.null(mi_res)) {
  top_mi <- head(mi_res[mi_res$mi > 10, ], 5)
  if (nrow(top_mi) > 0) {
    for (i in seq_len(nrow(top_mi))) {
      mi_list[[i]] <- list(
        lhs = top_mi$lhs[i],
        op  = top_mi$op[i],
        rhs = top_mi$rhs[i],
        mi  = round(top_mi$mi[i], 2),
        epc = round(top_mi$epc[i], 3)
      )
    }
    warnings_list <- c(warnings_list,
      "Yüksek modifikasyon indeksleri mevcut. UYARI: Teorik gerekçe olmadan modifikasyon yapmayın.")
  }
}

# ------ JSON Çıktısı ------
out <- list(
  success = TRUE,
  n       = as.integer(n),
  syntax  = syntax,
  fit = list(
    chi2        = as.numeric(fm$chisq),
    df          = as.integer(fm$df),
    chi2df      = as.numeric(chi2df),
    pValue      = as.numeric(fm$pvalue),
    cfi         = as.numeric(fm$cfi),
    tli         = as.numeric(fm$tli),
    rmsea       = as.numeric(fm$rmsea),
    rmseaCI     = c(as.numeric(fm$rmsea.ci.lower), as.numeric(fm$rmsea.ci.upper)),
    srmr        = as.numeric(fm$srmr),
    gfi         = as.numeric(fm$gfi),
    aic         = as.numeric(fm$aic),
    bic         = as.numeric(fm$bic),
    isAdequate  = is_adequate,
    fitSummary  = fit_summary
  ),
  standardizedLoadings = loadings_list,
  ave      = ave_list,
  cr       = cr_list,
  modificationIndices = mi_list,
  estimator = estimator,
  warnings = warnings_list
)

cat(toJSON(out, auto_unbox = TRUE, null = "null"))
