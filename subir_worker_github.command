#!/bin/bash
# Envia o codigo do Worker (Cloudflare) do Azimo pro GitHub pela primeira vez
# (e nas proximas vezes que precisar). So funciona depois que o repositorio
# "azimo-worker" ja existir no GitHub, vazio, criado pelo Anderson.
cd "$(dirname "$0")"
rm -f .git/HEAD.lock .git/index.lock

REMOTO="git@github.com:dasilvaandersonduarte/azimo-worker.git"
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Conectando no repositorio $REMOTO ..."
  git remote add origin "$REMOTO"
fi

echo "Enviando pro GitHub..."
git push -u origin main
PUSH_STATUS=$?

echo ""
if [ $PUSH_STATUS -eq 0 ]; then
  echo "Pronto! Codigo do Worker salvo em https://github.com/dasilvaandersonduarte/azimo-worker"
else
  echo "########################################################################"
  echo "FALHOU (codigo $PUSH_STATUS). Veja o erro do git acima antes de seguir."
  echo "Causa mais comum: o repositorio 'azimo-worker' ainda nao existe no"
  echo "GitHub, ou foi criado com algum arquivo dentro (README, .gitignore) --"
  echo "precisa estar 100% vazio na primeira vez."
  echo "########################################################################"
fi
