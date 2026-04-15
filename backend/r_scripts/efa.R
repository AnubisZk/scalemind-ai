# ============================================================
# ScaleMind AI — EFA (Açımlayıcı Faktör Analizi) R Scripti
# psych paketi + GPArotation + nFactors
# ============================================================
# Bu script r_runner.py tarafından çağrılır.
# Input: INPUT_JSON çevre değişkeni (JSON string)
# Output: stdout'a JSON
# ============================================================

library(psych)
library(jsonlite)
library(GPArotation)

# Input oku
input_json <- Sys.getenv("SCALEMIND_INPUT")
params <- fromJSON(input_json, simplifyVector = TRUE)

data_list <- params$data
items     <- params$items
options   <- params$options

# DataFrame oluştur
df <- as.data.frame(data_list)[, items, drop = FALSE]
df <- na.omit(df)
n  <- nrow(df)
k  <- ncol(df)

result <- list()
warnings_list <- c()

# ------ KMO ve Bartlett ------
kmo_res    <- KMO(df)
bart_res   <- cortest.bartlett(df)

kmo_value  <- round(kmo_res$MSA, 3)
bart_chi2  <- round(as.numeric(bart_res$chisq), 3)
bart_df    <- as.integer(bart_res$df)
bart_p     <- round(as.numeric(bart_res$p.value), 4)
det_val    <- round(det(cor(df)), 6)

# KMO yorumu
kmo_interp <- if (kmo_value >= 0.90) "Mükemmel" else
              if (kmo_value >= 0.80) "Çok iyi" else
              if (kmo_value >= 0.70) "Orta" else
              if (kmo_value >= 0.60) "Zayıf" else "Kabul edilemez"

if (kmo_value < 0.60) {
  warnings_list <- c(warnings_list,
    paste0("KMO = ", kmo_value, " çok düşük. EFA bu veri seti için uygun olmayabilir."))
}
if (bart_p > 0.05) {
  warnings_list <- c(warnings_list,
    "Bartlett testi anlamsız — değişkenler arasında yeterli korelasyon yok.")
}

# ------ Faktör Sayısı Belirleme ------
eigen_vals <- eigen(cor(df))$values
scree_data <- round(eigen_vals, 3)

# Parallel analysis
pa_res <- tryCatch(
  fa.parallel(df, fa = "fa", plot = FALSE, n.iter = 100, quiet = TRUE),
  error = function(e) NULL
)
n_parallel <- if (!is.null(pa_res)) pa_res$nfact else sum(eigen_vals > 1)

# Kullanıcı faktör sayısı
n_factors <- if (!is.null(options$nFactors) && options$nFactors > 0) {
  as.integer(options$nFactors)
} else {
  as.integer(max(1, n_parallel))
}

# Çıkarma ve rotasyon
extraction <- if (is.null(options$extraction)) "minres" else options$extraction
rotation   <- if (is.null(options$rotation)) "oblimin" else options$rotation

# ------ EFA ------
fa_res <- tryCatch(
  fa(df, nfactors = n_factors, fm = extraction, rotate = rotation,
     scores = "regression"),
  error = function(e) {
    warnings_list <<- c(warnings_list, paste("EFA hatası:", e$message))
    NULL
  }
)

if (is.null(fa_res)) {
  cat(toJSON(list(
    success = FALSE,
    error = "EFA hesaplanamadı",
    warnings = warnings_list
  ), auto_unbox = TRUE))
  quit(status = 0)
}

# ------ Çıktıları Hazırla ------
loadings_mat  <- unclass(fa_res$loadings)  # k x nfactors
communalities <- round(as.numeric(fa_res$communalities), 3)
uniqueness    <- round(as.numeric(fa_res$uniquenesses), 3)

# Faktör isimleri
factor_names <- paste0("F", seq_len(n_factors))
rownames(loadings_mat) <- items
colnames(loadings_mat) <- factor_names

# Varyans açıklama
# Varyans açıklama - güvenli erişim
vaccounted <- fa_res$Vaccounted
if (!is.null(vaccounted) && nrow(vaccounted) >= 3) {
  prop_var <- vaccounted["Proportion Var", seq_len(n_factors)]
  cum_var  <- vaccounted["Cumulative Var", seq_len(n_factors)]
} else {
  prop_var <- rep(NA, n_factors)
  cum_var  <- rep(NA, n_factors)
}
var_explained <- data.frame(
  factor     = factor_names,
  eigenvalue = round(eigen_vals[seq_len(n_factors)], 3),
  variance   = round(as.numeric(prop_var) * 100, 2),
  cumulative = round(as.numeric(cum_var) * 100, 2)
)

# Loadings matrisi — listeye dönüştür
loadings_list <- lapply(seq_len(nrow(loadings_mat)), function(i) {
  as.list(round(loadings_mat[i, ], 3))
})
names(loadings_list) <- items

# Çapraz yükler (>.32 iki faktörde birden)
cross_loadings <- list()
if (n_factors > 1) {
  for (i in seq_along(items)) {
    row <- loadings_mat[i, ]
    above <- which(abs(row) > 0.32)
    if (length(above) >= 2) {
      cross_loadings[[length(cross_loadings) + 1]] <- list(
        item    = items[i],
        factors = factor_names[above],
        values  = round(row[above], 3)
      )
    }
  }
}

# Faktör-madde eşleşmesi (en yüksek yük .40+)
factor_item_map <- lapply(seq_len(n_factors), function(j) {
  high <- which(abs(loadings_mat[, j]) >= 0.40)
  items[high]
})
names(factor_item_map) <- factor_names

# Düşük yükler (hiçbir faktörde .40 yok)
low_load_items <- items[apply(abs(loadings_mat), 1, max) < 0.40]
if (length(low_load_items) > 0) {
  warnings_list <- c(warnings_list,
    paste0("Hiçbir faktörde .40 üzeri yük taşımayan maddeler: ",
           paste(low_load_items, collapse = ", ")))
}

# ------ JSON Çıktısı ------
out <- list(
  success       = TRUE,
  kmo           = kmo_value,
  kmoInterpretation = kmo_interp,
  bartlettChi2  = bart_chi2,
  bartlettDf    = bart_df,
  bartlettP     = bart_p,
  determinant   = det_val,
  eigenvalues   = scree_data,
  parallelN     = as.integer(n_parallel),
  suggestedFactors = as.integer(n_parallel),
  selectedFactors  = as.integer(n_factors),
  extractionMethod = extraction,
  rotation         = rotation,
  loadings         = loadings_list,
  variableNames    = items,
  factorNames      = factor_names,
  communalities    = communalities,
  uniqueness       = uniqueness,
  varianceExplained = var_explained,
  crossLoadings    = cross_loadings,
  factorItemMap    = factor_item_map,
  lowLoadItems     = low_load_items,
  n                = as.integer(n),
  warnings         = warnings_list
)

cat(toJSON(out, auto_unbox = TRUE, null = "null"))
