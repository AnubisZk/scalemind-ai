# ============================================================
# ScaleMind AI — Güvenirlik Analizi R Scripti
# psych: Cronbach alpha + McDonald omega
# ============================================================

library(psych)
library(jsonlite)

input_json <- Sys.getenv("SCALEMIND_INPUT")
params     <- fromJSON(input_json, simplifyVector = FALSE)

data_list  <- params$data
items      <- unlist(params$items)
subscales  <- params$subscales  # {name: [items]} veya boş

selected <- data_list[items]
max_len <- max(sapply(selected, length))
data_padded <- lapply(selected, function(x) {
  x <- as.numeric(unlist(x))
  length(x) <- max_len
  x
})
df <- as.data.frame(data_padded)
df <- na.omit(df)
n  <- nrow(df)

compute_reliability <- function(sub_df, item_names) {
  k <- ncol(sub_df)
  if (k < 2) return(list(error = "Tek madde — güvenirlik hesaplanamaz"))

  # Cronbach alpha
  alpha_res <- alpha(sub_df, check.keys = FALSE)
  ca   <- round(alpha_res$total$raw_alpha, 3)
  ca_lo <- round(alpha_res$total$raw_alpha - 1.96 * alpha_res$total$ase, 3)
  ca_hi <- round(alpha_res$total$raw_alpha + 1.96 * alpha_res$total$ase, 3)

  # McDonald omega
  omega_res <- tryCatch(
    omega(sub_df, plot = FALSE, nfactors = 1),
    error = function(e) NULL
  )
  omega_t <- if (!is.null(omega_res)) round(omega_res$omega.tot, 3) else NA
  omega_h <- if (!is.null(omega_res)) round(omega_res$omega_h, 3) else NA

  # Split-half
  n_half1 <- floor(k / 2)
  half1   <- rowSums(sub_df[, 1:n_half1, drop = FALSE])
  half2   <- rowSums(sub_df[, (n_half1 + 1):k, drop = FALSE])
  sh_r    <- round(cor(half1, half2), 3)
  sb      <- round(2 * sh_r / (1 + sh_r), 3)  # Spearman-Brown

  # Inter-item korelasyon ortalaması
  corr_mat <- cor(sub_df)
  off_diag <- corr_mat[upper.tri(corr_mat)]
  mean_iic <- round(mean(off_diag), 3)

  # Alpha if deleted
  alpha_if_del <- round(alpha_res$alpha.drop[, "raw_alpha"], 3)
  names(alpha_if_del) <- item_names

  # Yorum
  interpretation <- if (ca >= 0.90) "Mükemmel (≥.90)" else
                    if (ca >= 0.80) "İyi (.80–.89)" else
                    if (ca >= 0.70) "Kabul edilebilir (.70–.79)" else
                    if (ca >= 0.60) "Zayıf (.60–.69)" else
                    "Kabul edilemez (<.60)"

  list(
    n               = as.integer(n),
    nItems          = as.integer(k),
    cronbachAlpha   = ca,
    cronbachAlphaCI = c(ca_lo, ca_hi),
    mcdonaldOmegaTotal       = omega_t,
    mcdonaldOmegaHierarchical = omega_h,
    splitHalf      = sh_r,
    spearmanBrown  = sb,
    meanInterItemCorr = mean_iic,
    alphaIfDeleted = as.list(alpha_if_del),
    interpretation = interpretation
  )
}

# Genel güvenirlik
overall <- compute_reliability(df, items)

# Alt boyut güvenirliği
subscale_results <- list()
if (!is.null(subscales) && length(subscales) > 0) {
  for (sub_name in names(subscales)) {
    sub_items <- unlist(subscales[[sub_name]])
    valid_items <- sub_items[sub_items %in% colnames(df)]
    if (length(valid_items) >= 2) {
      sub_df <- df[, valid_items, drop = FALSE]
      sub_res <- compute_reliability(sub_df, valid_items)
      sub_res$name  <- sub_name
      sub_res$items <- valid_items
      subscale_results[[sub_name]] <- sub_res
    }
  }
}

out <- c(overall, list(
  subscales = subscale_results,
  warnings  = character(0)
))

# Uyarılar
warnings_out <- c()
if (!is.na(overall$cronbachAlpha) && overall$cronbachAlpha < 0.70) {
  warnings_out <- c(warnings_out,
    paste0("Cronbach alpha (", overall$cronbachAlpha, ") .70 altında — güvenirlik düşük."))
}
if (!is.na(overall$mcdonaldOmegaTotal) && overall$mcdonaldOmegaTotal < 0.70) {
  warnings_out <- c(warnings_out,
    paste0("McDonald omega (", overall$mcdonaldOmegaTotal, ") .70 altında."))
}
# Yalnız alpha yeterli değil uyarısı
if (!is.na(overall$cronbachAlpha)) {
  warnings_out <- c(warnings_out,
    "NOT: Cronbach alpha tek başına yeterli güvenirlik kanıtı değildir. McDonald omega ile birlikte raporlayın.")
}

out$warnings <- warnings_out
cat(toJSON(out, auto_unbox = TRUE, null = "null"))
