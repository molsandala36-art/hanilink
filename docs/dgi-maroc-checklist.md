# Checklist Conformite DGI Maroc

Cette checklist sert de base produit pour aligner HaniLink avec les exigences documentaires et fiscales courantes du CGI marocain.

## Couvre par l'application

- Informations vendeur imprimees sur les documents:
  - raison sociale / nom boutique
  - adresse
  - ICE
  - IF
  - RC
- Informations client imprimees sur les documents:
  - nom
  - telephone
  - adresse
  - ICE client
  - IF client
  - RC client
- Totaux documentaires:
  - total HT
  - TVA
  - total TTC
- Mode de paiement et reference de paiement sur les factures
- Numerotation lisible par type de document:
  - `FAC-YYYY-000001`
  - `DEV-YYYY-000001`
  - `BL-YYYY-000001`
  - `BA-YYYY-000001`
  - `BT-YYYY-000001`
- Verrouillage des documents valides:
  - edition bloquee
  - suppression bloquee
  - correction a faire via retour ou document correctif
- Type documentaire `avoir` disponible pour les corrections commerciales/fiscales
- Generation guidee d'un `avoir` depuis une facture existante
- Option explicite de remise en stock lors de la validation d'un avoir
- Metadonnees d'audit sur les documents:
  - `created_by`
  - `updated_by`
  - `validated_by`
  - `validated_at`

## A renforcer ensuite

- Sequence serveur transactionnelle pour eviter tout risque de doublon en concurrence
- Journal d'audit complet:
  - cree par
  - valide par
  - date de validation
  - annulation / correction
- Avoir fiscal dedie en plus des retours
- Export fiscal TVA structure pour les besoins comptables
- Controles de format plus stricts sur ICE / IF / RC
- Regles metier sur echeance et references de paiement obligatoires selon type de document

## Notes importantes

- Cette checklist vise une conformite documentaire et metier progressive.
- Elle ne doit pas etre presentee comme une certification officielle DGI sans validation juridique ou administrative explicite.
