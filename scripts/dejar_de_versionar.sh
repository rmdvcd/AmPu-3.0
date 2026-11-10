#!/usr/bin/env bash
# Retira del control de versiones lo que no es código del proyecto (hallazgos M1 y M2):
#   · build_temp/  copia de un build antiguo (14 000 archivos)
#   · vendor/      dependencias instaladas (14 000 archivos, binarios de Linux x86-64)
#   · *.pyc        bytecode
# No borra nada del disco: solo deja de versionarlo. Tras ejecutarlo, las dependencias
# se instalan con:  pip install --target vendor --no-compile -r requirements.txt
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

antes=$(git ls-files | wc -l)
git rm -r --cached --quiet --ignore-unmatch build_temp vendor
git ls-files -z '*.pyc' | xargs -0 -r git rm --cached --quiet --ignore-unmatch
sed -i 's|^# vendor/$|vendor/|' .gitignore
git add .gitignore
despues=$(git ls-files | wc -l)

echo "Archivos versionados: ${antes} → ${despues}"
echo "Revisa con «git status» y confirma con:"
echo "  git commit -m 'Deja de versionar vendor/, build_temp/ y bytecode'"
