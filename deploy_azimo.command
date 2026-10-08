#!/bin/bash
# Conexao Azimo isolada da conta de outros projetos (item de infra, 15/09;
# trava de conta reforcada em 22/09 depois de um deploy cair pra conta errada
# da Cloudflare sem avisar).
export XDG_CONFIG_HOME="$HOME/.config/azimo-cloudflare"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20
cd "$(dirname "$0")"

EMAIL_ESPERADO="dasilvaandersonduarte@gmail.com"
EMAIL_ATUAL=$(wrangler whoami 2>&1 | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' | head -1)

if [ "$EMAIL_ATUAL" != "$EMAIL_ESPERADO" ]; then
  echo ""
  echo "########################################################################"
  echo "PARADO: a Cloudflare CLI nao esta logada na conta certa do Azimo."
  echo "Esperado: $EMAIL_ESPERADO"
  echo "Logado agora: ${EMAIL_ATUAL:-nenhuma conta (nao logado)}"
  echo ""
  echo "Isso normalmente acontece quando o login foi feito com a conta de"
  echo "outro projeto (ex: Clinica Beleza Rara) nessa mesma janela isolada."
  echo ""
  echo "Rode nesta mesma janela, nesta ordem, e confirme no navegador que abrir"
  echo "com a conta $EMAIL_ESPERADO:"
  echo "  wrangler logout"
  echo "  wrangler login"
  echo "Depois rode este arquivo de novo."
  echo "########################################################################"
  echo ""
  exit 1
fi

echo "Conta Cloudflare confirmada: $EMAIL_ATUAL"
echo "Fazendo deploy do Worker azimo-proxy..."
wrangler deploy
DEPLOY_STATUS=$?

echo ""
if [ $DEPLOY_STATUS -eq 0 ]; then
  echo "Deploy concluido com sucesso. Feche esta janela."
else
  echo "########################################################################"
  echo "DEPLOY FALHOU (codigo $DEPLOY_STATUS). NAO feche achando que deu certo."
  echo "Veja o erro do wrangler acima e resolva antes de considerar publicado."
  echo "########################################################################"
fi
