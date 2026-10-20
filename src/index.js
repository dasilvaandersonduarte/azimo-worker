export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ─── Stripe Webhook ──────────────────────────────────────────────
    if (url.pathname === '/stripe-webhook' && request.method === 'POST') {
      return handleStripeWebhook(request, env);
    }

    // ─── Claude Proxy + rotas autenticadas ───────────────────────────
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [
      'https://files-chi-seven.vercel.app',
      'https://files-3jym2oxbs-anderson-duarte-s-projects.vercel.app',
      'https://azimo.life',
      'https://www.azimo.life'
    ];
    const isAllowed = allowedOrigins.includes(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    // ─── Admin: buscar todos os assinantes (GET) ──────────────────────
    if (url.pathname === '/admin/subscribers' && request.method === 'GET') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleAdminSubscribers(request, env, origin);
    }

    // ─── Solicitacao de Cancelamento ─────────────────────────────────
    if (url.pathname === '/cancelamento' && request.method === 'POST') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleCancelamento(request, env, origin);
    }

    // ─── Config público (chave Stripe para frontend) ─────────────────
    if (url.pathname === '/config') {
      const corsOrigin = isAllowed ? origin : allowedOrigins[2];
      return new Response(JSON.stringify({
        stripePk: env.STRIPE_PUBLISHABLE_KEY || '',
        trialDays: 14
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
        }
      });
    }

    // ─── Trial Start (sem cartão — mantido para compatibilidade) ─────
    if (url.pathname === '/trial-start' && request.method === 'POST') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleTrialStart(request, env, origin);
    }

    // ─── Trial Start com Cartão (modelo Netflix/Spotify) ─────────────
    if (url.pathname === '/trial-start-with-card' && request.method === 'POST') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleTrialStartWithCard(request, env, origin);
    }

    // ─── Reassinar (usuario ja existente, trial/assinatura expirada) ──
    if (url.pathname === '/resubscribe' && request.method === 'POST') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleResubscribe(request, env, origin);
    }

    // ─── Convites: registrar código gerado no painel admin ───────────
    if (url.pathname === '/invite/register' && request.method === 'POST') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleInviteRegister(request, env, origin);
    }

    // ─── Beta gratuito: convites (admin) e resgate (usuario) ──────────
    if (url.pathname === '/admin/beta/invite' && request.method === 'POST') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleBetaInviteCreate(request, env, origin);
    }
    if (url.pathname === '/admin/beta/invites' && request.method === 'GET') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleBetaInviteList(request, env, origin);
    }
    if (url.pathname === '/admin/beta/invite/revoke' && request.method === 'POST') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleBetaInviteRevoke(request, env, origin);
    }
    if (url.pathname === '/beta/redeem' && request.method === 'POST') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleBetaRedeem(request, env, origin);
    }

    // ─── Stripe Customer Portal ───────────────────────────────────────
    if (url.pathname === '/customer-portal' && request.method === 'POST') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleCustomerPortal(request, env, origin);
    }

    // ─── Cancelar Assinatura (automatizado via Stripe) ────────────────
    if (url.pathname === '/cancelar-assinatura' && request.method === 'POST') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleCancelarAssinatura(request, env, origin);
    }

    // ─── Frente 1: extracao de fatura/comprovante por IA (item 115) ──────────
    if (url.pathname === '/fatura-extrair' && request.method === 'POST') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleFaturaExtrair(request, env, origin);
    }

    // ─── Frente 2: deteccao de estrutura (blocos) de planilha por IA (item 131) ──
    if (url.pathname === '/planilha-extrair' && request.method === 'POST') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handlePlanilhaExtrair(request, env, origin);
    }

    // ─── Google Agenda: pull de eventos via feed iCal privado (item 95) ──────
    if (url.pathname === '/gcal-events' && request.method === 'POST') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleGcalEvents(request, env, origin);
    }

    // ─── Notificar Anderson de um feedback recem-enviado (o insert em si ──
    // acontece direto do frontend pro Supabase; esse endpoint so dispara o
    // email, pra nao expor a chave do Resend no cliente) ──────────────────
    if (url.pathname === '/notify-feedback' && request.method === 'POST') {
      if (!isAllowed) return new Response('Forbidden', { status: 403 });
      return handleNotifyFeedback(request, env, origin);
    }

    if (request.method !== 'POST' && request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (!isAllowed) {
      return new Response('Forbidden', { status: 403 });
    }

    const body = await request.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
      }
    });
  },

  // ─── Cron diário: reengajamento de trials inativos ────────────────────────
  async scheduled(event, env, ctx) {
    if (event.cron === '*/5 * * * *') {
      ctx.waitUntil(verificarEDispararPush(env));
    } else {
      ctx.waitUntil(checkReengagement(env));
    }
  }
};

// ─── Stripe Webhook Handler ──────────────────────────────────────────────────

async function handleStripeWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') || '';

  const valid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response('Invalid signature', { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  try {
    const type = event.type;

    // Pagamento confirmado via Payment Link
    if (type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode !== 'subscription') return new Response('ok');

      const email = session.customer_email || session.customer_details?.email;
      const stripeCustomerId = session.customer;
      const stripeSubscriptionId = session.subscription;
      // Identifica plano pelo total: R$397 = 39700 centavos
      const planType = (session.amount_total || 0) > 10000 ? 'anual' : 'mensal';

      if (email) {
        await upsertSubscriber(env, {
          email,
          stripeCustomerId,
          stripeSubscriptionId,
          status: 'ativo',
          planType,
          periodEnd: null,
        });
        // Notificacao para Anderson: nova assinatura paga (pagamento direto via Payment Link)
        await notifyAnderson(env,
          `Nova assinatura ativa: ${email}`,
          `<h2>Assinatura paga confirmada</h2><p><strong>Email:</strong> ${email}</p><p><strong>Plano:</strong> ${planType}</p><p><strong>Stripe Customer:</strong> ${stripeCustomerId}</p><p>Pagamento direto via Payment Link (sem trial). Acesse o Azimo Command para ver o assinante.</p>`
        );
      }
    }

    // Renovação, mudança de status, upgrade/downgrade
    else if (type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const stripeStatus = sub.status; // active | past_due | canceled | unpaid | trialing
      const status = stripeStatus === 'active' ? 'ativo'
                   : stripeStatus === 'trialing' ? 'trial'
                   : stripeStatus === 'canceled' ? 'cancelado'
                   : 'expirado';
      const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
      const subInfo = await getSubscriberByCustomerId(env, sub.customer);
      const email = subInfo ? subInfo.email : null;
      const previousStatus = event.data.previous_attributes?.status;

      if (email) {
        await upsertSubscriber(env, {
          email,
          stripeCustomerId: sub.customer,
          stripeSubscriptionId: sub.id,
          status,
          planType: null,
          periodEnd,
        });
        // Notificacao para Anderson: trial convertido em assinatura paga (primeira cobranca real)
        if (previousStatus === 'trialing' && stripeStatus === 'active') {
          await notifyAnderson(env,
            `Trial virou assinatura paga: ${email}`,
            `<h2>Trial convertido em assinatura paga</h2><p><strong>Email:</strong> ${email}</p><p><strong>Stripe Subscription:</strong> ${sub.id}</p><p><strong>Proxima cobranca:</strong> ${new Date(periodEnd).toLocaleDateString('pt-BR')}</p><p>Primeira cobranca real ja processada pelo Stripe. Acesse o Azimo Command para ver o assinante.</p>`
          );
          // Email pro usuario confirmando a primeira cobranca real
          const primeiroNome = (await getNomeByUserId(env, subInfo.user_id)) || 'você';
          const amountCents = sub.items?.data?.[0]?.price?.unit_amount || 0;
          const amountFmt = (amountCents / 100).toFixed(2).replace('.', ',');
          const periodEndFmt = new Date(periodEnd).toLocaleDateString('pt-BR');
          await sendUserEmail(env, email,
            `${primeiroNome}, isso já é oficial.`,
            emailWrap(`
              <p style="font-size:15px;margin-top:0">${primeiroNome},</p>
              <p style="font-size:15px">Sua assinatura começou pra valer agora. R$${amountFmt} foi cobrado no cartão que você cadastrou, e o próximo ciclo cai em ${periodEndFmt}.</p>
              <p style="font-size:15px">Isso não muda nada no que a gente vinha construindo nos últimos 14 dias. O mesmo histórico, o mesmo contexto, a mesma rotina. Só que agora sem prazo de validade.</p>
              <p style="font-size:15px">Se alguma coisa nessa cobrança não bateu com o que você esperava, responde esse email antes de qualquer outra coisa. Sou eu mesmo que leio.</p>
              <a href="https://www.azimo.life?login=1" style="display:inline-block;background:#6366F1;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;margin-top:8px">Abrir o Azimo</a>
            `)
          );
        }
        // Cobranca falhou (cartao recusado, expirado, sem saldo etc): Anderson precisa
        // saber na hora, porque o assinante pode nao perceber ate perder o acesso.
        if (previousStatus === 'active' && stripeStatus === 'past_due') {
          await notifyAnderson(env,
            `Cobranca falhou: ${email}`,
            `<h2>Pagamento recusado</h2><p><strong>Email:</strong> ${email}</p><p><strong>Stripe Subscription:</strong> ${sub.id}</p><p>O Stripe vai tentar cobrar de novo automaticamente nos proximos dias. Se falhar todas as tentativas, o acesso e suspenso. Considera avisar o assinante direto se for alguem que voce conhece.</p>`
          );
        }
      }
    }

    // Cancelamento
    else if (type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const subInfo = await getSubscriberByCustomerId(env, sub.customer);
      const email = subInfo ? subInfo.email : null;
      if (email) {
        await updateSubscriberStatus(env, email, 'cancelado');
        // Notificacao para Anderson: assinatura cancelada (adicionado sessao 8, parte 5)
        await notifyAnderson(env,
          `Assinatura cancelada: ${email}`,
          `<h2>Assinatura cancelada</h2><p><strong>Email:</strong> ${email}</p><p><strong>Stripe Subscription:</strong> ${sub.id}</p><p>Acesso mantido ate o fim do periodo ja pago. Acesse o Azimo Command para ver detalhes.</p>`
        );
        // Nota: o email de confirmacao pro usuario ja e enviado na hora do pedido,
        // em handleCancelarAssinatura. Esse webhook so dispara quando o Stripe
        // efetivamente encerra a assinatura no fim do periodo (acesso ja acabou
        // nesse ponto), entao nao repetimos o email aqui pra nao mandar duas vezes
        // com timing e mensagem incoerentes entre si.
      }
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
    return new Response('Internal error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
}

// ─── Notificacao por email para Anderson (eventos de assinatura) ─────────────

async function notifyAnderson(env, subject, html) {
  if (!env.RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.RESEND_API_KEY },
      body: JSON.stringify({
        from: 'Azimo <noreply@azimo.life>',
        to: ['dasilvaandersonduarte@gmail.com'],
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error('notifyAnderson error:', err);
  }
}

// ─── Notificacao de feedback recebido ────────────────────────────────────
// O feedback em si ja foi salvo no Supabase direto pelo frontend antes de
// chamar essa rota (sbClient.from('feedbacks').insert). Aqui so mandamos o
// email pro Anderson, porque a chave do Resend nao pode ir pro cliente.
async function handleNotifyFeedback(request, env, origin) {
  const corsOrigin = ['https://azimo.life','https://www.azimo.life','https://files-chi-seven.vercel.app','https://files-3jym2oxbs-anderson-duarte-s-projects.vercel.app'].includes(origin) ? origin : 'null';

  let body;
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const texto = (body.texto || '').toString().slice(0, 2000);
  const categoria = (body.categoria || 'Geral').toString().slice(0, 60);
  const userEmail = body.user_email || 'Anonimo';

  await notifyAnderson(env,
    `Novo feedback (${categoria}): ${userEmail}`,
    `<h2>Feedback recebido no Azimo</h2><p><strong>De:</strong> ${userEmail}</p><p><strong>Categoria:</strong> ${categoria}</p><p><strong>Mensagem:</strong></p><p style="white-space:pre-wrap;background:#f5f5f7;padding:12px;border-radius:8px">${texto}</p><p>Acesse o Azimo Command, aba Feedbacks, pra ver e responder.</p>`
  );

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
  });
}

// ─── Verificação de Assinatura Stripe (HMAC-SHA256 via WebCrypto) ────────────

async function verifyStripeSignature(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = header.split(',');
  const tPart = parts.find(p => p.startsWith('t='));
  if (!tPart) return false;
  const timestamp = tPart.slice(2);
  const signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3));

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Rejeitar eventos com mais de 5 minutos
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  return signatures.includes(expectedSig);
}

// ─── Supabase Helpers ─────────────────────────────────────────────────────────

async function getUserIdByEmail(env, email) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_user_id_by_email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
    },
    body: JSON.stringify({ p_email: email }),
  });
  if (!resp.ok) return null;
  const result = await resp.json();
  return result || null;
}

async function getEmailByCustomerId(env, customerId) {
  const info = await getSubscriberByCustomerId(env, customerId);
  return info ? info.email : null;
}

async function getSubscriberByCustomerId(env, customerId) {
  // Busca email e user_id na tabela subscribers (já deve estar lá do checkout.session.completed)
  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/subscribers?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=email,user_id&limit=1`,
    {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
      }
    }
  );
  if (!resp.ok) return null;
  const rows = await resp.json();
  return rows.length > 0 ? rows[0] : null;
}

async function getNomeByUserId(env, userId) {
  if (!userId) return null;
  try {
    const resp = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
      }
    });
    if (!resp.ok) return null;
    const user = await resp.json();
    const fullName = user?.user_metadata?.full_name;
    return fullName ? fullName.split(' ')[0] : null;
  } catch {
    return null;
  }
}

async function sendUserEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.RESEND_API_KEY },
      body: JSON.stringify({ from: 'Azimo <noreply@azimo.life>', to: [to], subject, html }),
    });
  } catch (err) {
    console.error('sendUserEmail error:', err.message);
  }
}

function emailWrap(bodyHtml) {
  return `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a2e;line-height:1.7">
    <p style="font-size:15px;color:#6366F1;font-weight:600;margin-bottom:4px">Vio</p>
    ${bodyHtml}
  </div>`;
}

async function upsertSubscriber(env, { email, stripeCustomerId, stripeSubscriptionId, status, planType, periodEnd }) {
  // Tenta pegar o user_id pelo email
  const userId = await getUserIdByEmail(env, email);

  const payload = {
    email,
    status,
    updated_at: new Date().toISOString(),
    ...(userId ? { user_id: userId } : {}),
    ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
    ...(stripeSubscriptionId ? { stripe_subscription_id: stripeSubscriptionId } : {}),
    ...(planType ? { plan_type: planType } : {}),
    ...(periodEnd ? { current_period_end: periodEnd } : {}),
  };

  await fetch(`${env.SUPABASE_URL}/rest/v1/subscribers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });
}

async function updateSubscriberStatus(env, email, status) {
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    }
  );
}

// ─── Trial Start ─────────────────────────────────────────────────────────────

async function handleTrialStart(request, env, origin) {
  const corsOrigin = ['https://azimo.life','https://www.azimo.life','https://files-chi-seven.vercel.app','https://files-3jym2oxbs-anderson-duarte-s-projects.vercel.app'].includes(origin) ? origin : 'null';

  let body;
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { user_id, email, nome, trial_end, invite_code } = body;
  if (!email || !user_id) return new Response('email e user_id obrigatorios', { status: 400 });

  const primeiroNome = (nome || 'você').split(' ')[0];

  // 0. Validar e resgatar código de convite, se enviado (nunca bloqueia o cadastro)
  const invitedCode = await redeemInviteCode(env, invite_code, user_id, email);

  // 1. Criar registro de trial no Supabase
  await fetch(`${env.SUPABASE_URL}/rest/v1/subscribers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      user_id,
      email,
      status: 'trial',
      plan_type: 'trial',
      current_period_end: trial_end || new Date(Date.now() + 14 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      ...(invitedCode ? { invite_code_used: invitedCode } : {}),
    }),
  });

  if (!env.RESEND_API_KEY) {
    return new Response(JSON.stringify({ ok: true, emails: 'skipped' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  }

  // Notificacao para Anderson: novo usuario se cadastrou
  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.RESEND_API_KEY },
    body: JSON.stringify({
      from: 'Azimo <noreply@azimo.life>',
      to: ['dasilvaandersonduarte@gmail.com'],
      subject: `Novo usuario no Azimo: ${nome || email}`,
      html: `<h2>Novo cadastro</h2><p><strong>Nome:</strong> ${nome || 'Nao informado'}</p><p><strong>Email:</strong> ${email}</p><p><strong>Trial ate:</strong> ${body.trial_end ? new Date(body.trial_end).toLocaleDateString('pt-BR') : '14 dias a partir de hoje'}</p><p>Acesse o Azimo Command para ver o assinante.</p>`,
    }),
  }).catch(() => {});

  const sendEmail = async (subject, html, scheduledAt) => {
    const payload = { from: 'Azimo <noreply@azimo.life>', to: [email], subject, html };
    if (scheduledAt) payload.scheduled_at = scheduledAt;
    return fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.RESEND_API_KEY },
      body: JSON.stringify(payload),
    });
  };

  const trialEndFmt = new Date(trial_end).toLocaleDateString('pt-BR');
  const d = (days) => new Date(Date.now() + days * 86400000).toISOString();

  // D+0 imediato
  await sendEmail(
    `Vio aqui, ${primeiroNome}. Pode começar.`,
    `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a2e;line-height:1.7">
      <p style="font-size:15px;color:#6366F1;font-weight:600;margin-bottom:4px">Vio</p>
      <p style="font-size:15px;margin-top:0">${primeiroNome},</p>
      <p style="font-size:15px">Seu acesso está ativo. Esse email é curto porque o que precisa acontecer é dentro do app, não aqui.</p>
      <p style="font-size:15px">Antes de qualquer coisa: preencha seu perfil. É lá que eu entendo quem você é, onde você quer chegar e o que está travando. Sem isso, eu sou um chatbot genérico. Com isso, eu viro seu mentor de fato.</p>
      <p style="font-size:15px">Tenho 14 dias com você. Vou usar todos eles.</p>
      <a href="https://www.azimo.life?login=1" style="display:inline-block;background:#6366F1;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;margin-top:8px">Abrir o Azimo agora</a>
      <p style="font-size:12px;color:#999;margin-top:24px">Acesso gratuito até ${trialEndFmt}. Nenhuma cobrança durante o trial.</p>
    </div>`
  );

  // D+1 agendado
  await sendEmail(
    `${primeiroNome}, como foi ontem?`,
    `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a2e;line-height:1.7">
      <p style="font-size:15px;color:#6366F1;font-weight:600;margin-bottom:4px">Vio</p>
      <p style="font-size:15px;margin-top:0">${primeiroNome},</p>
      <p style="font-size:15px">Você abriu o app ontem. Mas a pergunta que me interessa é: você registrou algo?</p>
      <p style="font-size:15px">Não precisa ter sido perfeito. Um pilar marcado já é mais do que zero. O padrão que eu preciso ver não aparece num dia. Aparece na repetição.</p>
      <p style="font-size:15px">Hoje você tem dois minutos. Usa eles.</p>
      <a href="https://www.azimo.life?login=1" style="display:inline-block;background:#6366F1;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;margin-top:8px">Registrar meu dia</a>
    </div>`,
    d(1)
  );

  // D+7 agendado
  await sendEmail(
    `${primeiroNome}, 7 dias. O que os dados dizem?`,
    `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a2e;line-height:1.7">
      <p style="font-size:15px;color:#6366F1;font-weight:600;margin-bottom:4px">Vio</p>
      <p style="font-size:15px;margin-top:0">${primeiroNome},</p>
      <p style="font-size:15px">Uma semana. Você já tem material suficiente para a revisão semanal ser útil de verdade.</p>
      <p style="font-size:15px">Não é um checklist de culpa. É um balanço real: o que você fez, o que você evitou e o que esse padrão diz sobre o que você vai fazer nos próximos 7 dias.</p>
      <p style="font-size:15px">Me abre lá. Vamos ver juntos.</p>
      <a href="https://www.azimo.life?login=1" style="display:inline-block;background:#6366F1;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;margin-top:8px">Ver revisão da semana</a>
    </div>`,
    d(7)
  );

  // D+13 agendado — trial acabando amanhã
  const LINK_MENSAL = 'https://buy.stripe.com/7sY14hdWmfT25088sd0co00';
  const LINK_ANUAL  = 'https://buy.stripe.com/aFaeV7f0q5eoaks0ZL0co01';
  const emailEnc = encodeURIComponent(email||'');
  await sendEmail(
    `${primeiroNome}, amanhã o trial acaba`,
    `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a2e;line-height:1.7">
      <p style="font-size:15px;color:#6366F1;font-weight:600;margin-bottom:4px">Vio</p>
      <p style="font-size:15px;margin-top:0">${primeiroNome},</p>
      <p style="font-size:15px">Amanhã o seu trial encerra. O que construímos nos últimos 14 dias, todo o contexto que eu tenho sobre você, some se o acesso fechar.</p>
      <p style="font-size:15px">Não vou te convencer. Você já sabe o que o Azimo faz ou não faz por você. O que eu te peço é que a decisão seja consciente, não uma omissão.</p>
      <p style="font-size:15px">R$47 por mês ou R$397 por ano. Escolha o que faz mais sentido:</p>
      <div style="margin:24px 0;display:flex;gap:12px">
        <a href="${LINK_MENSAL}${emailEnc ? '?prefilled_email='+emailEnc : ''}" style="display:inline-block;background:#6366F1;color:#fff;padding:13px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700">Continuar por R$47/mes</a>
        <a href="${LINK_ANUAL}${emailEnc ? '?prefilled_email='+emailEnc : ''}" style="display:inline-block;background:#1a1a2e;border:2px solid #6366F1;color:#6366F1;padding:11px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700">R$397/ano (2 meses grátis)</a>
      </div>
      <p style="font-size:12px;color:#999">Alguma dúvida antes de decidir? Responde esse email. Sou eu mesmo que leio.</p>
    </div>`,
    d(13)
  );

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
  });
}

// ─── Convites: registro e resgate de código ──────────────────────────────────
// O código em si continua sendo gerado no cliente (gerarCodigoConvite, index.html).
// Este endpoint só persiste esse código no Supabase pra ele poder ser validado
// e marcado como usado de verdade no cadastro — sem isso, convite era só cosmético.

async function handleInviteRegister(request, env, origin) {
  const corsOrigin = origin;
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token ausente' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }
    const userResp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + token }
    });
    if (!userResp.ok) {
      return new Response(JSON.stringify({ error: 'Token invalido' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }
    const userData = await userResp.json();
    if (userData.email !== 'dasilvaandersonduarte@gmail.com') {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }

    let body;
    try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
    const code = (body.code || '').trim().toUpperCase();
    if (!code) return new Response('code obrigatorio', { status: 400 });

    await fetch(`${env.SUPABASE_URL}/rest/v1/invite_codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
        'Prefer': 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify({ code }),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  }
}

// Valida um código de convite e marca como usado (atômico o suficiente pro nosso volume:
// se dois cadastros baterem no mesmo código ao mesmo tempo, o segundo PATCH ainda
// funciona mas o "vencedor" registrado é só informativo, não é uma trava de negócio).
// Nunca lança erro pro chamador — convite invalido/expirado nao pode travar cadastro.
async function redeemInviteCode(env, rawCode, userId, email) {
  const code = (rawCode || '').trim().toUpperCase();
  if (!code) return null;
  try {
    const resp = await fetch(
      `${env.SUPABASE_URL}/rest/v1/invite_codes?code=eq.${encodeURIComponent(code)}&select=code,used_at`,
      { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY } }
    );
    if (!resp.ok) return null;
    const rows = await resp.json();
    const row = rows[0];
    if (!row || row.used_at) return null; // código inexistente ou já usado — ignora, não bloqueia

    await fetch(`${env.SUPABASE_URL}/rest/v1/invite_codes?code=eq.${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ used_by_email: email, used_by_user_id: userId, used_at: new Date().toISOString() }),
    });
    return code;
  } catch (e) {
    return null;
  }
}

// ─── Solicitacao de Cancelamento ─────────────────────────────────────────────

// ─── Beta gratuito: convites, resgate e revogacao ─────────────────────────────
// Segue exatamente o mesmo padrao de autenticacao admin de handleAdminSubscribers/
// handleInviteRegister (token Supabase -> confere email do admin), sem duplicar risco novo.
async function requireAdminBeta(request, env, corsOrigin) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return { error: new Response(JSON.stringify({ error: 'Token ausente' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin } }) };
  }
  const userResp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + token }
  });
  if (!userResp.ok) {
    return { error: new Response(JSON.stringify({ error: 'Token invalido' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin } }) };
  }
  const userData = await userResp.json();
  if (userData.email !== 'dasilvaandersonduarte@gmail.com') {
    return { error: new Response(JSON.stringify({ error: 'Acesso negado' }), { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin } }) };
  }
  return { userId: userData.id, email: userData.email };
}

async function handleBetaInviteCreate(request, env, origin) {
  const corsOrigin = origin;
  try {
    const admin = await requireAdminBeta(request, env, corsOrigin);
    if (admin.error) return admin.error;

    let body;
    try { body = await request.json(); } catch { return new Response(JSON.stringify({error:'Dados inválidos.'}), {status:400,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':corsOrigin}}); }
    const nome = String(body.destinatario_nome || '').trim();
    if (!nome || nome.length > 120) return new Response(JSON.stringify({error:'Informe o nome da pessoa (até 120 caracteres).'}), {status:400,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':corsOrigin}});
    const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/azimo_beta_invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ created_by: admin.userId, destinatario_nome: nome }),
    });
    if (!resp.ok) throw new Error('Falha ao criar convite (' + resp.status + ')');
    const rows = await resp.json();
    return new Response(JSON.stringify(rows[0] || {}), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  }
}

async function handleBetaInviteList(request, env, origin) {
  const corsOrigin = origin;
  try {
    const admin = await requireAdminBeta(request, env, corsOrigin);
    if (admin.error) return admin.error;

    const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/azimo_beta_invites?select=*&order=created_at.desc`, {
      headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY }
    });
    if (!resp.ok) throw new Error('Falha ao consultar convites');
    const data = await resp.json();
    // Enriquecimento opcional so de email (nao critico); falha de enriquecimento nunca esconde o convite.
    for (const row of data) {
      if (!row.redeemed_by) continue;
      try {
        const ur = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${row.redeemed_by}`, {
          headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY }
        });
        if (ur.ok) { const u = await ur.json(); row.redeemed_by_email = u.email || null; }
      } catch (_) { /* enriquecimento opcional, nao bloqueia listagem */ }
    }
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  }
}

async function handleBetaInviteRevoke(request, env, origin) {
  const corsOrigin = origin;
  try {
    const admin = await requireAdminBeta(request, env, corsOrigin);
    if (admin.error) return admin.error;

    let body;
    try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
    const code = (body.code || '').trim();
    if (!code) return new Response('code obrigatorio', { status: 400 });

    // Bloqueia resgate futuro (se ainda nao foi resgatado, isso ja basta).
    await fetch(`${env.SUPABASE_URL}/rest/v1/azimo_beta_invites?code=eq.${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    });

    // Se ja tinha sido resgatado, corta o acesso de fato: revoga azimo_beta_access
    // e derruba o status em subscribers (so quando plan_type=beta, nunca mexe em assinante pago).
    const inviteResp = await fetch(`${env.SUPABASE_URL}/rest/v1/azimo_beta_invites?code=eq.${encodeURIComponent(code)}&select=redeemed_by`, {
      headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY }
    });
    const inviteRows = inviteResp.ok ? await inviteResp.json() : [];
    const redeemedBy = inviteRows[0] && inviteRows[0].redeemed_by;
    if (redeemedBy) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/azimo_beta_access?user_id=eq.${encodeURIComponent(redeemedBy)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      });
      await fetch(`${env.SUPABASE_URL}/rest/v1/subscribers?user_id=eq.${encodeURIComponent(redeemedBy)}&plan_type=eq.beta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'cancelado', updated_at: new Date().toISOString() }),
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  }
}

async function handleBetaRedeem(request, env, origin) {
  const corsOrigin = origin;
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Sessao ausente. Faca login antes de resgatar o convite.' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }
    const userResp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + token }
    });
    if (!userResp.ok) {
      return new Response(JSON.stringify({ error: 'Sessao invalida. Faca login novamente.' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }
    const userData = await userResp.json();

    let body;
    try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
    const code = (body.code || '').trim();
    if (!code) {
      return new Response(JSON.stringify({ error: 'Codigo obrigatorio' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }

    // Nunca converte uma assinatura paga ou trial vigente em beta.
    const existingResp = await fetch(`${env.SUPABASE_URL}/rest/v1/subscribers?user_id=eq.${encodeURIComponent(userData.id)}&select=status,current_period_end&limit=1`, {
      headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY }
    });
    const existingRows = existingResp.ok ? await existingResp.json() : [];
    const existing = existingRows[0];
    const jaAtivo = existing && (existing.status === 'ativo' || (['trial', 'cancelamento_agendado'].includes(existing.status) && existing.current_period_end && new Date(existing.current_period_end) >= new Date()));
    if (jaAtivo) {
      return new Response(JSON.stringify({ error: 'Esta conta ja tem acesso ativo.' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }

    // RPC SECURITY DEFINER: valida o convite, marca como resgatado e concede em azimo_beta_access
    // de forma atomica (ver Estrategia/beta_acesso.sql). So o Worker com service key chega aqui.
    const rpcResp = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/azimo_redeem_beta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY },
      body: JSON.stringify({ p_code: code, p_user_id: userData.id }),
    });
    if (!rpcResp.ok) throw new Error('Falha ao validar convite (' + rpcResp.status + ')');
    const ok = await rpcResp.json();
    if (!ok) {
      return new Response(JSON.stringify({ error: 'Codigo invalido, ja usado ou revogado.' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }

    // Reaproveita o upsert ja usado por trial/assinatura paga, so muda status/plano.
    // Isso faz o beta "existir" pro paywall/Command sem duplicar a logica de gate em outro lugar.
    await upsertSubscriber(env, { email: userData.email, status: 'ativo', planType: 'beta' });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  }
}

async function handleCancelamento(request, env, origin) {
  let body;
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { email, user_id, nome, motivo, status } = body;
  if (!email) return new Response('email required', { status: 400 });

  // status 'processado' e usado pelo fluxo self-serve (o usuario ja cancelou a
  // assinatura de verdade via /cancelar-assinatura antes de chamar essa rota;
  // isso aqui so registra o motivo como inteligencia de produto, nao ha nada
  // pendente pra voce processar manualmente). Sem status explicito, mantem o
  // comportamento antigo ('pendente'), usado por qualquer fluxo manual/legado.
  const statusFinal = status === 'processado' ? 'processado' : 'pendente';

  const corsOrigin = ['https://azimo.life','https://www.azimo.life','https://files-chi-seven.vercel.app','https://files-3jym2oxbs-anderson-duarte-s-projects.vercel.app'].includes(origin) ? origin : 'null';

  // Salva no Supabase
  await fetch(`${env.SUPABASE_URL}/rest/v1/cancelamento_solicitacoes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ email, user_id: user_id || null, nome: nome || null, motivo: motivo || null, status: statusFinal }),
  });

  // Envia email via Resend (se configurado)
  if (env.RESEND_API_KEY) {
    const jaProcessado = statusFinal === 'processado';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'Azimo <noreply@azimo.life>',
        to: ['dasilvaandersonduarte@gmail.com'],
        subject: jaProcessado ? `Cancelamento self-serve: ${nome || email}` : `Solicitacao de cancelamento: ${nome || email}`,
        html: `<h2>${jaProcessado ? 'Cancelamento automatico processado' : 'Nova solicitacao de cancelamento'}</h2><p><strong>Usuario:</strong> ${nome || 'Nao informado'}</p><p><strong>Email:</strong> ${email}</p><p><strong>Motivo:</strong> ${motivo || 'Nao informado'}</p><p>${jaProcessado ? 'A assinatura ja foi cancelada automaticamente pelo proprio usuario. Nao ha nada pra voce fazer, isso e so o registro do motivo.' : 'Acesse o Azimo Command para processar.'}</p>`,
      }),
    });
  }

  return new Response('ok', {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin },
  });
}

// ─── Stripe Request Helper ────────────────────────────────────────────────────

async function stripeRequest(env, method, path, params = {}) {
  const body = method !== 'GET' ? new URLSearchParams(params).toString() : undefined;
  const url = method === 'GET'
    ? `https://api.stripe.com${path}?${new URLSearchParams(params)}`
    : `https://api.stripe.com${path}`;

  const resp = await fetch(url, {
    method,
    headers: {
      'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    ...(body ? { body } : {}),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || `Stripe error ${resp.status}`);
  return data;
}

// ─── Trial Start com Cartão (Netflix/Spotify model) ──────────────────────────

async function handleTrialStartWithCard(request, env, origin) {
  const corsOrigin = ['https://azimo.life','https://www.azimo.life','https://files-chi-seven.vercel.app','https://files-3jym2oxbs-anderson-duarte-s-projects.vercel.app'].includes(origin) ? origin : 'null';

  if (!env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Stripe nao configurado' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin } });
  }

  let body;
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { user_id, email, nome, payment_method_id, plan_type, invite_code } = body;
  if (!email || !user_id || !payment_method_id) {
    return new Response('Campos obrigatorios faltando', { status: 400 });
  }

  const invitedCode = await redeemInviteCode(env, invite_code, user_id, email);

  const primeiroNome = (nome || 'você').split(' ')[0];
  // Dois planos lado a lado (item 88/0, 22/09): mensal R$59 como ancora, anual
  // R$39,90 x 12 = R$478,80/ano como o valor de fato empurrado. Cada um referencia
  // um Price ID fixo, pre-criado uma unica vez no Stripe Dashboard, em vez de
  // price_data inline -- evita criar um Produto/Preco novo duplicado no Stripe a
  // cada assinatura (sessao 01/09, mantido na expansao de 22/09).
  const STRIPE_PRICE_ANUAL = env.STRIPE_PRICE_ANUAL || 'price_1UB1F57DWMRlw7GbECmPKeZc';
  const STRIPE_PRICE_MENSAL = env.STRIPE_PRICE_MENSAL;
  // Trial publico de 14 dias tirado de vigencia (decisao do Anderson, 30/08): quem
  // assina hoje ja e cobrado na hora, protegido pelo reembolso integral em 7 dias
  // (ver handleCancelarAssinatura). Uma demonstracao pontual continua possivel na mao,
  // via Azimo Command, sem precisar desse endpoint oferecer trial pra qualquer um.
  const planKey = (plan_type === 'mensal' && STRIPE_PRICE_MENSAL) ? 'mensal' : 'anual';
  const stripePriceId = planKey === 'mensal' ? STRIPE_PRICE_MENSAL : STRIPE_PRICE_ANUAL;

  // Item 294 (Anderson, 18/10): quem entra com um Codigo de Convite valido (o de
  // rastreio, nao o de Acesso -- esse ja' e' tratado sem cartao em outro fluxo)
  // ganha 15 dias gratuitos com cartao ja cadastrado, sem cobranca ate o fim do
  // periodo. Decisao explicita do Anderson: pedir cartao so depois do trial gera
  // mais abandono do que pedir ja no cadastro sem cobrar na hora.
  const temTrialConvite = !!invitedCode;

  try {
    // 1. Criar Customer no Stripe
    const customer = await stripeRequest(env, 'POST', '/v1/customers', {
      email,
      name: nome || '',
      'metadata[user_id]': user_id,
    });

    // 2. Anexar PaymentMethod ao Customer
    await stripeRequest(env, 'POST', `/v1/payment_methods/${payment_method_id}/attach`, {
      customer: customer.id,
    });

    // 3. Criar Subscription -- com 15 dias de trial se veio de Codigo de Convite,
    // cobranca imediata nos demais casos (decisao do Anderson, 30/08, mantida).
    const subscription = await stripeRequest(env, 'POST', '/v1/subscriptions', {
      customer: customer.id,
      'items[0][price]': stripePriceId,
      default_payment_method: payment_method_id,
      'payment_settings[save_default_payment_method]': 'on_subscription',
      ...(temTrialConvite ? { trial_period_days: 15 } : {}),
    });

    const periodEndIso = new Date(subscription.current_period_end * 1000).toISOString();

    // 4. Registrar subscriber no Supabase -- 'trial' durante os 15 dias gratuitos
    // do convite, 'ativo' quando a cobranca ja aconteceu na hora (sem convite).
    await fetch(`${env.SUPABASE_URL}/rest/v1/subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id,
        email,
        status: temTrialConvite ? 'trial' : 'ativo',
        plan_type: planKey,
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        current_period_end: periodEndIso,
        updated_at: new Date().toISOString(),
        ...(invitedCode ? { invite_code_used: invitedCode } : {}),
      }),
    });

    // 5. Notificacao para Anderson: nova assinatura paga
    if (env.RESEND_API_KEY) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.RESEND_API_KEY },
        body: JSON.stringify({
          from: 'Azimo <noreply@azimo.life>',
          to: ['dasilvaandersonduarte@gmail.com'],
          subject: temTrialConvite ? `Novo trial de convite (15 dias): ${nome || email}` : `Nova assinatura paga: ${nome || email}`,
          html: temTrialConvite
            ? `<h2>Novo cadastro via Codigo de Convite, 15 dias gratuitos</h2><p><strong>Nome:</strong> ${nome || 'Nao informado'}</p><p><strong>Email:</strong> ${email}</p><p><strong>Codigo usado:</strong> ${invitedCode}</p><p><strong>Plano:</strong> ${planKey} (R$${(PRECO_ANUAL_CENTAVOS/100).toFixed(2).replace('.',',')})</p><p><strong>Stripe Customer:</strong> ${customer.id}</p><p><strong>Subscription:</strong> ${subscription.id}</p><p><strong>Cartao cadastrado, sem cobranca ate:</strong> ${new Date(periodEndIso).toLocaleDateString('pt-BR')}</p>`
            : `<h2>Novo cadastro com cartao, cobranca imediata</h2><p><strong>Nome:</strong> ${nome || 'Nao informado'}</p><p><strong>Email:</strong> ${email}</p><p><strong>Plano:</strong> ${planKey} (R$${(PRECO_ANUAL_CENTAVOS/100).toFixed(2).replace('.',',')})</p><p><strong>Stripe Customer:</strong> ${customer.id}</p><p><strong>Subscription:</strong> ${subscription.id}</p><p><strong>Renova em:</strong> ${new Date(periodEndIso).toLocaleDateString('pt-BR')}</p>`,
        }),
      }).catch(() => {});
    }

    // 6. Sequencia de emails de onboarding (sem mais menção a trial, o acesso já é definitivo)
    if (env.RESEND_API_KEY) {
      const d = (days) => new Date(Date.now() + days * 86400000).toISOString();

      const sendEmail = async (subject, html, scheduledAt) => {
        const payload = { from: 'Azimo <noreply@azimo.life>', to: [email], subject, html };
        if (scheduledAt) payload.scheduled_at = scheduledAt;
        return fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.RESEND_API_KEY },
          body: JSON.stringify(payload),
        });
      };

      const rodapeEmailD0 = temTrialConvite
        ? `<p style="font-size:12px;color:#999;margin-top:24px">Você tem 15 dias gratuitos, sem cobrança nenhuma até lá. Se não for pra você, cancela direto no app antes do fim do período.</p>`
        : `<p style="font-size:12px;color:#999;margin-top:24px">Se nos primeiros 7 dias você sentir que não é pra você, é só cancelar direto no app: reembolso integral, sem perguntas.</p>`;
      await sendEmail(
        `Vio aqui, ${primeiroNome}. Pode começar.`,
        `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a2e;line-height:1.7">
          <p style="font-size:15px;color:#6366F1;font-weight:600;margin-bottom:4px">Vio</p>
          <p style="font-size:15px;margin-top:0">${primeiroNome},</p>
          <p style="font-size:15px">Seu acesso está ativo. Esse email é curto porque o que precisa acontecer é dentro do app, não aqui.</p>
          <p style="font-size:15px">Antes de qualquer coisa: preencha seu perfil. É lá que eu entendo quem você é, onde você quer chegar e o que está travando. Sem isso, eu sou um chatbot genérico. Com isso, eu viro seu mentor de fato.</p>
          <a href="https://www.azimo.life?login=1" style="display:inline-block;background:#6366F1;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;margin-top:8px">Abrir o Azimo agora</a>
          ${rodapeEmailD0}
        </div>`
      );
      await sendEmail(
        `${primeiroNome}, como foi ontem?`,
        `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a2e;line-height:1.7">
          <p style="font-size:15px;color:#6366F1;font-weight:600;margin-bottom:4px">Vio</p>
          <p style="font-size:15px;margin-top:0">${primeiroNome},</p>
          <p style="font-size:15px">Você abriu o app ontem. Mas a pergunta que me interessa é: você registrou algo?</p>
          <p style="font-size:15px">Não precisa ter sido perfeito. Um pilar marcado já é mais do que zero. O padrão que eu preciso ver não aparece num dia. Aparece na repetição.</p>
          <p style="font-size:15px">Hoje você tem dois minutos. Usa eles.</p>
          <a href="https://www.azimo.life?login=1" style="display:inline-block;background:#6366F1;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;margin-top:8px">Registrar meu dia</a>
        </div>`,
        d(1)
      );
      await sendEmail(
        `${primeiroNome}, 7 dias. O que os dados dizem?`,
        `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a2e;line-height:1.7">
          <p style="font-size:15px;color:#6366F1;font-weight:600;margin-bottom:4px">Vio</p>
          <p style="font-size:15px;margin-top:0">${primeiroNome},</p>
          <p style="font-size:15px">Uma semana. Você já tem material suficiente para a revisão semanal ser útil de verdade.</p>
          <p style="font-size:15px">Não é um checklist de culpa. É um balanço real: o que você fez, o que você evitou e o que esse padrão diz sobre o que você vai fazer nos próximos 7 dias.</p>
          <p style="font-size:15px">Me abre lá. Vamos ver juntos.</p>
          <a href="https://www.azimo.life?login=1" style="display:inline-block;background:#6366F1;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;margin-top:8px">Ver revisão da semana</a>
        </div>`,
        d(7)
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });

  } catch (err) {
    console.error('trial-start-with-card error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  }
}

// ─── Reassinar (conta ja existe, trial ou assinatura anterior expirou) ───────
// Igual ao trial-start-with-card, mas sem criar conta nova no Supabase (o usuario
// ja tem uma) -- so cria Customer+Subscription novos no Stripe e atualiza o registro
// existente. Usado pela tela de paywall (30/08).
async function handleResubscribe(request, env, origin) {
  const corsOrigin = ['https://azimo.life','https://www.azimo.life','https://files-chi-seven.vercel.app','https://files-3jym2oxbs-anderson-duarte-s-projects.vercel.app'].includes(origin) ? origin : 'null';

  if (!env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Stripe nao configurado' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin } });
  }

  let body;
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { user_id, email, nome, payment_method_id, plan_type } = body;
  if (!email || !user_id || !payment_method_id) {
    return new Response('Campos obrigatorios faltando', { status: 400 });
  }

  const STRIPE_PRICE_ANUAL = env.STRIPE_PRICE_ANUAL || 'price_1UB1F57DWMRlw7GbECmPKeZc';
  const STRIPE_PRICE_MENSAL = env.STRIPE_PRICE_MENSAL;
  const planKey = (plan_type === 'mensal' && STRIPE_PRICE_MENSAL) ? 'mensal' : 'anual';
  const stripePriceId = planKey === 'mensal' ? STRIPE_PRICE_MENSAL : STRIPE_PRICE_ANUAL;

  try {
    const customer = await stripeRequest(env, 'POST', '/v1/customers', {
      email,
      name: nome || '',
      'metadata[user_id]': user_id,
    });

    await stripeRequest(env, 'POST', `/v1/payment_methods/${payment_method_id}/attach`, {
      customer: customer.id,
    });

    const subscription = await stripeRequest(env, 'POST', '/v1/subscriptions', {
      customer: customer.id,
      'items[0][price]': stripePriceId,
      default_payment_method: payment_method_id,
      'payment_settings[save_default_payment_method]': 'on_subscription',
    });

    const periodEndIso = new Date(subscription.current_period_end * 1000).toISOString();

    await fetch(`${env.SUPABASE_URL}/rest/v1/subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id,
        email,
        status: 'ativo',
        plan_type: planKey,
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        current_period_end: periodEndIso,
        updated_at: new Date().toISOString(),
      }),
    });

    await notifyAnderson(env,
      `Reassinatura: ${email}`,
      `<h2>Assinante voltou (reassinatura)</h2><p><strong>Email:</strong> ${email}</p><p><strong>Stripe Subscription:</strong> ${subscription.id}</p>`
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  } catch (err) {
    console.error('resubscribe error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  }
}

// ─── Cancelar Assinatura (automatizado) ──────────────────────────────────────

async function handleCancelarAssinatura(request, env, origin) {
  const corsOrigin = ['https://azimo.life','https://www.azimo.life','https://files-chi-seven.vercel.app','https://files-3jym2oxbs-anderson-duarte-s-projects.vercel.app'].includes(origin) ? origin : 'null';

  let body;
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { user_id, email, nome } = body;
  if (!user_id || !email) return new Response('user_id e email obrigatorios', { status: 400 });

  const primeiroNome = (nome || 'voce').split(' ')[0];

  // Busca dados do subscriber
  const subResp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/subscribers?user_id=eq.${encodeURIComponent(user_id)}&select=stripe_subscription_id,current_period_end&limit=1`,
    { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY } }
  );
  const rows = await subResp.json();
  const subscriber = rows[0];

  if (!subscriber) {
    return new Response(JSON.stringify({ error: 'Assinante nao encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  }

  let periodEnd = subscriber.current_period_end;
  let reembolsado = false;

  // Direito de arrependimento (CDC Art. 49): compra online pode ser cancelada com
  // reembolso integral em ate 7 dias da cobranca. Passado esse prazo, cancela normal
  // (cancel_at_period_end) -- acesso continua ate o fim do periodo ja pago, sem estorno.
  // Isso vale pra qualquer assinante, independente do plano, e nao e uma politica que
  // a Azimo escolhe aplicar ou nao -- e minimo legal, sempre ativo.
  if (subscriber.stripe_subscription_id && env.STRIPE_SECRET_KEY) {
    try {
      // Acha a fatura paga mais recente (a cobranca real, nao a fatura de trial em R$0)
      const invoices = await stripeRequest(env, 'GET', '/v1/invoices', {
        subscription: subscriber.stripe_subscription_id,
        status: 'paid',
        limit: 3,
      });
      const ultimaCobranca = (invoices.data || []).find(inv => (inv.amount_paid || 0) > 0);
      const diasDesdeCobranca = ultimaCobranca
        ? (Date.now() / 1000 - ultimaCobranca.created) / 86400
        : Infinity;

      if (ultimaCobranca && diasDesdeCobranca <= 7 && ultimaCobranca.charge) {
        // Dentro do prazo de arrependimento: reembolso integral + cancela na hora (nao so no fim do periodo)
        await stripeRequest(env, 'POST', '/v1/refunds', { charge: ultimaCobranca.charge });
        const sub = await stripeRequest(env, 'POST', `/v1/subscriptions/${subscriber.stripe_subscription_id}`, {
          cancel_at_period_end: 'false',
        });
        await stripeRequest(env, 'DELETE', `/v1/subscriptions/${subscriber.stripe_subscription_id}`, {});
        periodEnd = new Date().toISOString();
        reembolsado = true;
      } else {
        // Fora do prazo: cancela a renovacao, mantem acesso ate o fim do periodo pago, sem estorno
        const sub = await stripeRequest(env, 'POST', `/v1/subscriptions/${subscriber.stripe_subscription_id}`, {
          cancel_at_period_end: 'true',
        });
        periodEnd = new Date(sub.current_period_end * 1000).toISOString();
      }
    } catch (err) {
      console.error('Stripe cancel error:', err.message);
      // continua mesmo se Stripe falhar — atualiza Supabase de qualquer forma
    }
  }

  // Atualiza status no Supabase
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/subscribers?user_id=eq.${encodeURIComponent(user_id)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({ status: reembolsado ? 'cancelado' : 'cancelamento_agendado', updated_at: new Date().toISOString() }),
    }
  );

  // Email de confirmacao para o usuario
  if (env.RESEND_API_KEY) {
    const dataFim = periodEnd ? new Date(periodEnd).toLocaleDateString('pt-BR') : null;
    const corpoEmail = reembolsado
      ? `<p style="font-size:15px">Recebi seu pedido. Como está dentro dos 7 dias da sua compra, já processei o reembolso integral, ele deve aparecer no seu cartão em alguns dias úteis. Seu acesso foi encerrado agora.</p>`
      : `<p style="font-size:15px">Recebi seu pedido.${dataFim ? ` Seu acesso continua ativo até ${dataFim}, sem nenhuma cobrança depois disso.` : ' Nenhuma cobrança futura será feita.'}</p>`;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.RESEND_API_KEY },
      body: JSON.stringify({
        from: 'Azimo <noreply@azimo.life>',
        to: [email],
        subject: `Antes de você ir, ${primeiroNome}.`,
        html: `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a2e;line-height:1.7">
          <p style="font-size:15px;color:#6366F1;font-weight:600;margin-bottom:4px">Vio</p>
          <p style="font-size:15px;margin-top:0">${primeiroNome},</p>
          ${corpoEmail}
          <p style="font-size:15px">Se quiser me contar o que fez você sair, responde esse email. Eu leio de verdade, e isso muda o que a gente constrói daqui pra frente.</p>
          ${reembolsado ? '' : '<p style="font-size:15px">E se mudar de ideia antes dessa data, é só reativar pelo app. Nada do que você já registrou se perde.</p>'}
          <a href="https://www.azimo.life?login=1" style="display:inline-block;background:#6366F1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;margin-top:4px">Acessar o Azimo</a>
        </div>`,
      }),
    });
    // Anderson precisa saber de todo pedido de cancelamento, com ou sem reembolso
    if (reembolsado) {
      await notifyAnderson(env,
        `Reembolso processado: ${email}`,
        `<h2>Reembolso integral (direito de arrependimento, 7 dias)</h2><p><strong>Email:</strong> ${email}</p><p><strong>Usuario:</strong> ${nome || 'Nao informado'}</p><p>Cancelado e reembolsado automaticamente por estar dentro do prazo legal de 7 dias da compra.</p>`
      );
    } else {
      await notifyAnderson(env,
        `Pedido de cancelamento: ${email}`,
        `<h2>Cancelamento agendado (fora do prazo de reembolso)</h2><p><strong>Email:</strong> ${email}</p><p><strong>Usuario:</strong> ${nome || 'Nao informado'}</p><p>Sem reembolso, acesso segue ativo ate ${dataFim || 'o fim do periodo ja pago'}, sem renovacao depois disso.</p>`
      );
    }
  }

  return new Response(JSON.stringify({ ok: true, periodEnd, reembolsado }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
  });
}

// ─── Customer Portal (gerenciar cartão / cancelar via Stripe) ────────────────

async function handleCustomerPortal(request, env, origin) {
  const corsOrigin = ['https://azimo.life','https://www.azimo.life','https://files-chi-seven.vercel.app','https://files-3jym2oxbs-anderson-duarte-s-projects.vercel.app'].includes(origin) ? origin : 'null';

  if (!env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Stripe nao configurado' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin } });
  }

  let body;
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { user_id } = body;
  if (!user_id) return new Response('user_id obrigatorio', { status: 400 });

  const resp = await fetch(
    `${env.SUPABASE_URL}/rest/v1/subscribers?user_id=eq.${encodeURIComponent(user_id)}&select=stripe_customer_id&limit=1`,
    { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY } }
  );
  const rows = await resp.json();
  const customerId = rows[0]?.stripe_customer_id;

  if (!customerId) {
    return new Response(JSON.stringify({ error: 'Cliente Stripe nao encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin } });
  }

  try {
    const session = await stripeRequest(env, 'POST', '/v1/billing_portal/sessions', {
      customer: customerId,
      return_url: 'https://azimo.life',
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  }
}

// ─── Admin: buscar todos os assinantes ───────────────────────────────────────
async function handleAdminSubscribers(request, env, origin) {
  const corsOrigin = origin;
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token ausente' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }

    // Validar token com Supabase e verificar email do admin
    const userResp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + token,
      }
    });
    if (!userResp.ok) {
      return new Response(JSON.stringify({ error: 'Token invalido' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }
    const userData = await userResp.json();
    if (userData.email !== 'dasilvaandersonduarte@gmail.com') {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }

    // Buscar todos os assinantes com service key (bypass RLS)
    const sbResp = await fetch(
      `${env.SUPABASE_URL}/rest/v1/subscribers?select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
        }
      }
    );
    if (!sbResp.ok) throw new Error('Falha ao consultar assinantes');
    const data = await sbResp.json();
    if (!Array.isArray(data)) throw new Error('Resposta de assinantes invalida');
    // Optional activity enrichment: only metadata, never private state contents.
    const saved = new Map();
    const ids = [...new Set(data.map(s => s.user_id).filter(id => /^[0-9a-f-]{36}$/i.test(id || '')))];
    for (let i = 0; i < ids.length; i += 100) {
      try {
        const result = await fetch(`${env.SUPABASE_URL}/rest/v1/user_state?user_id=in.(${ids.slice(i,i+100).join(',')})&select=user_id,updated_at`, {
          headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY }
        });
        if (!result.ok) continue;
        const rows = await result.json();
        if (!Array.isArray(rows)) continue;
        for (const row of rows) if (typeof row.updated_at === 'string' && Number.isFinite(Date.parse(row.updated_at))) saved.set(row.user_id, row.updated_at);
      } catch (_) { /* No activity data must not hide subscribers. */ }
    }
    for (const subscriber of data) subscriber.command_activity = { last_saved_at: saved.get(subscriber.user_id) || null };

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin,
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  }
}

// ─── Reengajamento de trials inativos (rodado pelo cron diário) ──────────────

async function checkReengagement(env) {
  if (!env.RESEND_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return;

  // Janela de 24h que cobre "faltam entre 6 e 7 dias pro fim do trial",
  // ou seja, dia 7-8 de um trial de 14 dias. Como o cron roda 1x/dia,
  // cada assinante cai nessa janela em um unico disparo, sem precisar
  // de uma coluna extra de controle.
  const now = Date.now();
  const winStart = new Date(now + 6 * 86400000).toISOString();
  const winEnd = new Date(now + 7 * 86400000).toISOString();

  let rows = [];
  try {
    const resp = await fetch(
      `${env.SUPABASE_URL}/rest/v1/subscribers?status=eq.trial&current_period_end=gte.${winStart}&current_period_end=lt.${winEnd}&select=user_id,email,current_period_end`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
        }
      }
    );
    if (!resp.ok) return;
    rows = await resp.json();
  } catch (err) {
    console.error('checkReengagement fetch subscribers error:', err.message);
    return;
  }

  for (const row of rows) {
    if (!row.user_id || !row.email) continue;

    // Verifica se o usuario chegou a salvar algum estado no app, E se chegou a
    // efetivamente fechar algum dia (botao "Encerrar o Dia" no app, que grava
    // state.diasConcluidos). Um usuario pode ter updated_at recente so por ter
    // aberto o app e clicado em algo, sem nunca ter fechado um dia de verdade
    // (uso raso, sem constancia real) -- por isso os dois sinais juntos, nao so
    // o timestamp de escrita bruta.
    let inactive = true;
    try {
      const usResp = await fetch(
        `${env.SUPABASE_URL}/rest/v1/user_state?user_id=eq.${row.user_id}&select=updated_at,state`,
        {
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
          }
        }
      );
      if (usResp.ok) {
        const usRows = await usResp.json();
        if (usRows.length > 0) {
          const updatedAt = usRows[0].updated_at;
          const daysSinceUpdate = updatedAt ? (now - new Date(updatedAt).getTime()) / 86400000 : Infinity;
          const diasConcluidos = (usRows[0].state && usRows[0].state.diasConcluidos) || {};
          const nenhumDiaFechado = Object.keys(diasConcluidos).length === 0;
          inactive = daysSinceUpdate > 4 || nenhumDiaFechado;
        }
      }
    } catch (err) {
      console.error('checkReengagement fetch user_state error:', err.message);
      continue; // não manda email se não conseguiu confirmar o estado real
    }

    if (!inactive) continue;

    const primeiroNome = (await getNomeByUserId(env, row.user_id)) || 'você';
    const diasRestantes = row.current_period_end
      ? Math.max(1, Math.round((new Date(row.current_period_end).getTime() - now) / 86400000))
      : 7;

    await sendUserEmail(env, row.email,
      `${primeiroNome}, ainda estou aqui.`,
      emailWrap(`
        <p style="font-size:15px;margin-top:0">${primeiroNome},</p>
        <p style="font-size:15px">Faz uma semana que seu acesso está ativo e eu ainda não vi nada registrado. Pode ser falta de tempo, pode ser que o primeiro passo não ficou claro. As duas coisas se resolvem em menos de dois minutos.</p>
        <p style="font-size:15px">Não preciso que você organize a vida inteira hoje. Preciso só de um pilar marcado, pra eu começar a entender o seu padrão de verdade.</p>
        <p style="font-size:15px">Ainda restam ${diasRestantes} dias de acesso gratuito. Vale usar.</p>
        <a href="https://www.azimo.life?login=1" style="display:inline-block;background:#6366F1;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;margin-top:8px">Abrir o Azimo agora</a>
      `)
    );
  }
}

// ─── Google Agenda: pull de eventos via feed iCal privado (item 95, 28/09/2026) ──
// Anderson pede que os eventos do Google se misturem dentro da propria Sua Agenda
// do Azimo (nao um card separado). O feed iCal e o "endereco secreto" que o
// proprio Google Agenda oferece (Configuracoes > Integrar agenda) -- nao precisa
// de OAuth nem de projeto no Google Cloud, so' leitura.

// ─── Frente 1: extracao de fatura/comprovante por IA (item 115) ────────────
// Recebe o PDF (base64) ja' enviado pro Storage pelo cliente, manda pro Claude
// com instrucao estrita de extrair lancamentos em JSON (tool use, pra garantir
// formato valido). NADA aqui salva em lugar nenhum -- so' devolve o array
// extraido pro front-end montar a tela de revisao. Confirmar/salvar e' sempre
// uma acao explicita do usuario, feita no cliente (regra critica do spec).
const FATURA_CATEGORIAS = [
  'moradia','saude','educacao','transporte','tecnologia','financiamentos',
  'alimentacao','lazer','vestuario','beleza','viagens','outros_desp'
];


// ─── Item 131: registro de uso de IA (fatura + planilha) e limite mensal ──
// Guarda de abuso/bug, nao medida primaria de economia (custo por chamada e
// baixo, ver BACKLOG_MESTRE_AZIMO.md item 131). Tabela ia_uso_log precisa
// existir no Supabase (SQL de criacao documentado no backlog, Anderson roda
// no SQL Editor do Supabase).
const IA_LIMITE_MENSAL = 30;
const IA_PRECO_HAIKU_INPUT_USD_POR_MTOK = 1;
const IA_PRECO_HAIKU_OUTPUT_USD_POR_MTOK = 5;

async function _iaAuthUser(request, env){
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if(!token) return null;
  try{
    const resp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + token }
    });
    if(!resp.ok) return null;
    const data = await resp.json();
    return data && data.id ? data.id : null;
  }catch(e){
    return null;
  }
}

async function _iaUsoContarMes(env, userId){
  const inicioMes = new Date();
  inicioMes.setUTCDate(1);
  inicioMes.setUTCHours(0,0,0,0);
  const desde = inicioMes.toISOString();
  try{
    const resp = await fetch(
      `${env.SUPABASE_URL}/rest/v1/ia_uso_log?user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(desde)}&select=id`,
      { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY } }
    );
    if(!resp.ok) return 0;
    const rows = await resp.json();
    return Array.isArray(rows) ? rows.length : 0;
  }catch(e){
    return 0;
  }
}

function _iaCalcularCustoUsd(usage){
  if(!usage) return 0;
  const inTok = Number(usage.input_tokens)||0;
  const outTok = Number(usage.output_tokens)||0;
  return (inTok/1000000)*IA_PRECO_HAIKU_INPUT_USD_POR_MTOK + (outTok/1000000)*IA_PRECO_HAIKU_OUTPUT_USD_POR_MTOK;
}

async function _iaUsoRegistrar(env, userId, tipo, usage, detalhe){
  const custoUsd = _iaCalcularCustoUsd(usage);
  try{
    const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/ia_uso_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: userId,
        tipo,
        input_tokens: (usage && Number(usage.input_tokens)) || 0,
        output_tokens: (usage && Number(usage.output_tokens)) || 0,
        custo_usd: Number(custoUsd.toFixed(6)),
        detalhe: detalhe || null
      })
    });
    if(!resp.ok){
      const errText = await resp.text();
      return { ok: false, status: resp.status, erro: errText.slice(0,500) };
    }
    return { ok: true };
  }catch(e){
    return { ok: false, erro: 'excecao: ' + (e && e.message || String(e)) };
  }
}

async function handlePlanilhaExtrair(request, env, origin){
  const jsonHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin };
  try{
    const userId = await _iaAuthUser(request, env);
    if(!userId){
      return new Response(JSON.stringify({ error: 'Sessão expirada. Recarregue a página.' }), { status: 401, headers: jsonHeaders });
    }
    const usados = await _iaUsoContarMes(env, userId);
    if(usados >= IA_LIMITE_MENSAL){
      return new Response(JSON.stringify({ error: `Limite de ${IA_LIMITE_MENSAL} importações por IA neste mês atingido. Fale com o suporte se precisar de mais.`, limite_atingido: true }), { status: 429, headers: jsonHeaders });
    }

    const body = await request.json();
    const grid = body.grid;
    if(!Array.isArray(grid) || grid.length === 0){
      return new Response(JSON.stringify({ error: 'Planilha vazia ou inválida.' }), { status: 400, headers: jsonHeaders });
    }
    // Limite de seguranca: nao manda milhares de linhas pra IA (custo e contexto).
    const gridLimitado = grid.slice(0, 500);
    let numCols = 0;
    gridLimitado.forEach(l => { if(Array.isArray(l) && l.length > numCols) numCols = l.length; });
    const colLetra = (idx) => { let n=idx+1,s=''; while(n>0){ const r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=Math.floor((n-1)/26); } return s; };
    const linhasTexto = gridLimitado.map((linha, i) => {
      const celulas = [];
      for(let c=0; c<numCols; c++){
        const v = Array.isArray(linha) ? linha[c] : undefined;
        celulas.push(colLetra(c) + '=' + (v===undefined||v===null?'':String(v)));
      }
      return `L${i}: ` + celulas.join(' | ');
    });
    const gridTexto = linhasTexto.join('\n').slice(0, 60000);

    // 05/10: deteccao de separadores da IA errou varias vezes a fronteira entre dois
    // blocos empilhados na MESMA coluna (ex: Pagamento Prestadoras / Nubank), mesmo
    // havendo linhas em branco reais entre eles na planilha -- em vez de so pedir
    // em texto pra IA "prestar atencao", calculamos aqui (de forma 100% mecanica,
    // sem IA) os trechos vazios de cada coluna com 2+ linhas seguidas em branco, e
    // entregamos isso pronto como fronteira sugerida. Tira da IA o trabalho de
    // varrer centenas de linhas de texto procurando vazio por conta propria, que
    // era exatamente onde ela vinha errando.
    const vazioCel = (v) => v===undefined || v===null || String(v).trim()==='';
    const gapsTexto = '';

    const toolSchema = {
      name: 'detectar_estrutura_planilha',
      description: 'Identifica os blocos/secoes de lancamentos financeiros nesta planilha e, para cada bloco, quais colunas sao descricao, valor e (se existir) data.',
      input_schema: {
        type: 'object',
        properties: {
          blocos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nome: { type: 'string', description: 'Nome sugerido para este bloco/secao, em portugues correto, com acentuacao e letra inicial maiuscula. Vira o nome de um Controle (ex: "Bradesco Infinite", "Nubank", "Pagamento Prestadoras", "Fevereiro")' },
                linha_inicio: { type: 'number', description: 'Indice (o numero depois de L) da primeira linha de LANCAMENTO (nao o titulo do bloco) deste bloco' },
                linha_fim: { type: 'number', description: 'Indice da ultima linha de lancamento deste bloco, inclusive' },
                col_desc: { type: 'number', description: 'Indice da coluna (0=A, 1=B, ...) com a descricao/nome do lancamento neste bloco' },
                col_valor: { type: 'number', description: 'Indice da coluna com o valor do lancamento neste bloco. NUNCA aponte para uma coluna de soma/subtotal/total geral do bloco, so para o valor individual de cada linha' },
                col_data: { type: 'number', description: 'Indice da coluna com a data do lancamento, se este bloco tiver uma data por linha. Omita este campo se o bloco nao tiver coluna de data' },
                eh_resumo_ou_total: { type: 'boolean', description: 'true se este "bloco" for apenas um resumo/total/saldo geral (nao lancamentos individuais) e deve ser ignorado na importacao' },
                linha_total: { type: 'number', description: 'Se este bloco tiver, ao final, uma linha clara de SOMA/TOTAL/SUBTOTAL do bloco inteiro (nao confundir com uma linha de lancamento individual) e voce tiver confianca razoavel nela, o indice dessa linha -- ela NUNCA deve estar dentro do intervalo linha_inicio/linha_fim. Omita este campo se nao houver essa linha ou se nao tiver confianca suficiente' },
                col_total: { type: 'number', description: 'Indice da coluna onde fica o valor dessa linha de total/soma. Obrigatorio se linha_total for informado' }
              },
              required: ['nome','linha_inicio','linha_fim','col_desc','col_valor']
            }
          }
        },
        required: ['blocos']
      }
    };

    const anthropicBody = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      // 05/10: temperatura zero -- deteccao de estrutura tem que ser repetivel, a mesma
      // planilha nao pode dar resultado diferente a cada importacao. Sem isso a IA variava
      // entre chamadas mesmo recebendo o mesmo texto de entrada.
      temperature: 0,
      system: 'Voce analisa a ESTRUTURA de uma planilha financeira pessoal, para o app Azimo. A planilha e dada como texto, uma linha por vez no formato "Lx: A=valor | B=valor | ...", onde x e o indice da linha (comecando em 0) e a letra e o indice da coluna (A=0, B=1, etc). Importante: esta planilha pode ser um painel visual com VARIOS blocos/secoes lado a lado nas MESMAS linhas (por exemplo, colunas A e B sao um bloco "Bradesco", colunas D e E sao outro bloco "Nubank", na mesma faixa de linhas) -- identifique cada bloco de lancamentos financeiros separadamente, mesmo que compartilhem linhas com outro bloco. Um bloco pode tambem ser organizado por mes (ex: um bloco chamado "Fevereiro" com os gastos daquele mes). ATENCAO ESPECIAL a blocos pequenos de recorrencia anual: e comum existirem varios mini-blocos separados, cada um com so 1 a 3 lancamentos, identificados por um titulo que e so um nome de mes ou um intervalo de meses (ex: "Fevereiro", "Marco", "Agosto | Setembro | Outubro"), normalmente mais abaixo na planilha, separados uns dos outros por linha(s) em branco. NAO ignore esses mini-blocos por serem pequenos nem tente juntar varios deles num so -- cada um desses titulos de mes e o inicio de um bloco PROPRIO e separado, mesmo tendo uma unica linha de lancamento. Eles tendem a compartilhar as mesmas colunas de outro bloco maior que fica logo acima (ex: mesma coluna de descricao e valor de um bloco de "Pagamento Prestadoras"), mas sao blocos distintos, cada um pelo seu titulo de mes, nao uma continuacao do bloco de cima. Nunca confunda uma coluna de SOMA/SUBTOTAL/TOTAL (geralmente no fim de um bloco, um unico valor ou poucos valores que somam os outros) com a coluna de valor individual por lancamento -- se um "bloco" for so esse resumo, marque eh_resumo_ou_total=true e nao tente extrair linha por linha dele. Atencao tambem ao caso mais comum: um bloco de lancamentos legitimo que termina com UMA LINHA de SOMA/TOTAL/SUBTOTAL daquele bloco (ex: a ultima linha mostra "Soma" ou "Total" com o valor somado de todas as linhas acima) -- essa linha final NAO e um lancamento e NUNCA deve ficar dentro do intervalo linha_inicio/linha_fim (pare o intervalo na ultima linha de lancamento real, antes dela). Se voce tiver confianca razoavel de qual e essa linha de total do bloco, informe sua posicao em linha_total/col_total -- isso sera usado so como referencia de conferencia pro usuario comparar com a soma dos lancamentos, nunca sera somado como um lancamento a mais. Se nao tiver confianca sobre essa linha, omita linha_total e col_total em vez de arriscar um indice errado. Tambem nao confunda uma coluna de referencia de conta (ex: numero de conta, titular) com um bloco de lancamentos. ATENCAO CRITICA ao limite exato de cada bloco quando ha blocos empilhados nas mesmas colunas (um bloco menor logo abaixo de outro, ex: um bloco de titulo de mes ou um bloco novo como "Nubank" comecando logo depois de outro bloco como "Pagamento Prestadoras" terminar): o linha_inicio de um bloco NUNCA pode comecar antes da primeira linha que pertence de fato aquele bloco -- nao estenda o intervalo pra cima so porque as colunas sao as mesmas do bloco anterior. Preste atencao especial a linhas entre dois blocos que nao sao lancamentos de forma alguma: uma linha cujo conteudo e um link/URL (comecando com http, https ou www), um numero de referencia de boleto/cobranca, um codigo de identificacao de cliente ou conta, ou qualquer texto que nao seja claramente o nome de um gasto -- mesmo que exista um numero do lado parecendo um valor em reais, isso NAO e um lancamento e essa linha nao deve ficar dentro do linha_inicio/linha_fim de nenhum bloco, nem do bloco de cima nem do de baixo. Esse tipo de linha e so uma referencia/separador entre dois blocos distintos. Quando em duvida sobre onde um bloco realmente comeca, prefira um linha_inicio mais conservador (mais pra baixo, mais perto do primeiro lancamento claro) a incluir linhas de outro bloco ou de referencia por engano. DOIS CUIDADOS EXTRAS, confirmados como erros reais que ja aconteceram: primeiro, quando um mini-bloco de recorrencia anual tem uma linha de titulo (ex: a propria linha onde esta escrito "Fevereiro" ou "Agosto | Setembro | Outubro"), essa linha de titulo NUNCA e um lancamento e NUNCA deve ficar dentro de linha_inicio/linha_fim -- o linha_inicio desse bloco e sempre a PRIMEIRA linha DEPOIS do titulo que contem um lancamento de verdade (descricao + valor), nunca a linha do titulo em si. Segundo, cada bloco (inclusive os mini-blocos pequenos) tem que ter seu PROPRIO col_desc e col_valor determinados olhando onde a descricao e o valor REALMENTE aparecem pra aquele bloco especifico -- nunca herde ou copie o col_desc/col_valor de outro bloco so porque estao um embaixo do outro na planilha ou porque um bloco grande aparece logo acima. Um mini-bloco de mes pode perfeitamente usar colunas diferentes (ex: G e H) do bloco maior que fica acima dele (ex: A e B) -- confira a propria linha de dados do mini-bloco pra achar as colunas certas, nunca assuma. CUIDADO OPOSTO, tambem ja aconteceu como erro real: quando dois blocos DE VERDADE compartilham a MESMA coluna de proposito (um empilhado logo abaixo do outro, ex: "Pagamento Prestadoras" terminando e "Nubank" comecando logo abaixo, ambos usando as mesmas colunas D e E), o linha_inicio do bloco de baixo tem que ser ESTRITAMENTE MAIOR que o linha_fim (e o linha_total, se existir) do bloco de cima que usa a mesma coluna -- nunca igual, nunca menor, nunca comecando no meio ou antes do bloco de cima terminar. Antes de finalizar sua resposta, para cada par de blocos que compartilham col_desc e col_valor iguais, confira que os intervalos linha_inicio/linha_fim deles NAO se sobrepoe de jeito nenhum -- se sobrepuserem, um dos dois esta errado, corrija antes de responder. O bloco de baixo so comeca depois que o titulo, todos os lancamentos e a linha de soma/total do bloco de cima (e qualquer linha de referencia entre eles) ja tiverem ficado pra tras. Um bloco grande e homogeneo (mesmo padrao de descricao, valor e data repetindo, como uma fatura de cartao com dezenas de compras em sequencia) e SEMPRE um unico bloco do inicio ao fim, mesmo que existam uma ou duas linhas sem lancamento no meio dele (ex: um dia sem compra) -- nunca corte um bloco grande e continuo ao meio por causa disso. Na duvida entre cortar um bloco grande ao meio ou manter ele inteiro, mantenha ele inteiro. So retorne a ESTRUTURA (indices de linha e coluna) -- nunca copie nem reescreva os valores numericos ou textos das celulas no seu retorno, va direto nos indices. Se a planilha nao tiver nenhum bloco de lancamento financeiro identificavel, retorne blocos como lista vazia. Use a ferramenta detectar_estrutura_planilha para responder.',
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: gapsTexto + gridTexto + '\n\nIdentifique os blocos de lancamentos financeiros desta planilha usando a ferramenta detectar_estrutura_planilha.' }]
      }],
      tools: [toolSchema],
      tool_choice: { type: 'tool', name: 'detectar_estrutura_planilha' }
    };

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY_FATURA,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });

    if(!anthropicResp.ok){
      const errText = await anthropicResp.text();
      return new Response(JSON.stringify({ error: 'Falha ao processar com IA', detalhe: errText.slice(0,500) }), { status: 502, headers: jsonHeaders });
    }

    const data = await anthropicResp.json();
    const toolUse = (data.content || []).find(b => b.type === 'tool_use' && b.name === 'detectar_estrutura_planilha');
    if(!toolUse){
      return new Response(JSON.stringify({ error: 'IA não retornou a estrutura da planilha' }), { status: 502, headers: jsonHeaders });
    }

    // 05/10: inclui tambem os indices de coluna no log (so indices, nunca
    // valor de celula) -- precisei disso pra diagnosticar um bug real de
    // blocos pequenos pegando coluna errada, sem ter que ficar pedindo print
    // de novo a cada vez.
    const blocosResumo = (toolUse.input.blocos || []).map(b => ({
      nome: b.nome, linha_inicio: b.linha_inicio, linha_fim: b.linha_fim, eh_resumo_ou_total: !!b.eh_resumo_ou_total,
      col_desc: b.col_desc, col_valor: b.col_valor, col_data: b.col_data
    }));
    await _iaUsoRegistrar(env, userId, 'planilha', data.usage || null, { blocos: blocosResumo });

    return new Response(JSON.stringify({ blocos: toolUse.input.blocos || [] }), { headers: jsonHeaders });
  }catch(e){
    return new Response(JSON.stringify({ error: 'Falha ao processar a planilha' }), { status: 500, headers: jsonHeaders });
  }
}

async function handleFaturaExtrair(request, env, origin) {
  const jsonHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin };
  try {
    const userId = await _iaAuthUser(request, env);
    if(!userId){
      return new Response(JSON.stringify({ error: 'Sessão expirada. Recarregue a página.' }), { status: 401, headers: jsonHeaders });
    }
    const usados = await _iaUsoContarMes(env, userId);
    if(usados >= IA_LIMITE_MENSAL){
      return new Response(JSON.stringify({ error: `Limite de ${IA_LIMITE_MENSAL} importações por IA neste mês atingido. Fale com o suporte se precisar de mais.`, limite_atingido: true }), { status: 429, headers: jsonHeaders });
    }

    const body = await request.json();
    const pdfBase64 = body.pdfBase64;
    const pdfTexto = typeof body.pdfTexto === 'string' ? body.pdfTexto.trim() : '';
    // Item 131: quando o navegador conseguiu extrair o texto do PDF localmente
    // (sem IA), manda so' o texto -- muito mais barato que mandar o PDF
    // inteiro como imagem. Se nao deu pra extrair texto (ex: fatura
    // escaneada/foto), cai pro caminho antigo com o PDF em base64.
    const usandoTexto = pdfTexto.length > 40;
    if (!usandoTexto && (!pdfBase64 || typeof pdfBase64 !== 'string' || pdfBase64.length < 100)) {
      return new Response(JSON.stringify({ error: 'PDF não enviado ou inválido.' }), { status: 400, headers: jsonHeaders });
    }
    // Limite de seguranca: base64 de ~15MB de PDF original vira ~20MB em base64.
    if (!usandoTexto && pdfBase64.length > 28000000) {
      return new Response(JSON.stringify({ error: 'Arquivo muito grande.' }), { status: 413, headers: jsonHeaders });
    }
    if (usandoTexto && pdfTexto.length > 400000) {
      return new Response(JSON.stringify({ error: 'Arquivo muito grande.' }), { status: 413, headers: jsonHeaders });
    }

    const toolSchema = {
      name: 'registrar_lancamentos',
      description: 'Registra os lançamentos financeiros encontrados no documento.',
      input_schema: {
        type: 'object',
        properties: {
          documento_legivel: { type: 'boolean', description: 'false se o PDF não pode ser lido com confiança (ilegível, corrompido, ou não é uma fatura/comprovante financeiro)' },
          motivo_ilegivel: { type: 'string', description: 'Se documento_legivel=false, explique em 1 frase curta, em portugues do Brasil, com acentuacao correta, comecando com letra maiuscula e terminando com ponto final' },
          lancamentos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                desc: { type: 'string', description: 'Descricao do lancamento, como aparece no documento, em portugues correto' },
                val: { type: 'number', description: 'Valor em reais, sempre positivo' },
                data: { type: 'string', description: 'Data no formato YYYY-MM-DD. Se so houver dia/mes, use o ano de referencia da fatura' },
                cat: { type: 'string', enum: FATURA_CATEGORIAS, description: 'Categoria mais provavel' },
                parcela_atual: { type: 'number', description: 'Se for parcelado e o documento mostrar algo como 3/12, o numero atual (3). Omitir se nao for parcelado' },
                parcela_total: { type: 'number', description: 'Se for parcelado, o total de parcelas (12). Omitir se nao for parcelado' },
                confianca: { type: 'string', enum: ['alta','media','baixa'], description: 'Confianca na leitura deste lancamento especifico' },
                estorno: { type: 'boolean', description: 'true se esta linha for um estorno/credito de uma cobranca (ex: valor seguido de hifen como 260,00-), false ou omitido se for uma cobranca normal' }
              },
              required: ['desc', 'val', 'data', 'cat', 'confianca']
            }
          }
        },
        required: ['documento_legivel', 'lancamentos']
      }
    };

    const conteudoDocumento = usandoTexto
      ? { type: 'text', text: 'Conteudo do documento (texto extraido do PDF):\n\n' + pdfTexto }
      : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } };

    const anthropicBody = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16000,
      system: 'Voce extrai lancamentos financeiros de faturas de cartao de credito e comprovantes em PDF, para o app financeiro Azimo. A fatura pode ter varias paginas e dezenas de lancamentos (ex: uma fatura de cartao com 80 ou mais compras) -- extraia TODOS os lancamentos de TODAS as paginas, um por um, sem resumir, sem agrupar varios em um so, e sem parar antes do fim da lista so por ela ser longa. Se a fatura mostrar o mesmo lancamento em secoes diferentes (ex: lista geral e depois separado por cartao/pessoa), conte cada lancamento real uma unica vez, pela listagem mais detalhada. MUITO IMPORTANTE, regra de inclusao: so conte como lancamento uma COMPRA, DEBITO ou TAXA/ENCARGO real (coisas que a pessoa gastou ou foi cobrada). NUNCA inclua como lancamento: pagamento da PROPRIA fatura (linhas como PGTO, PAGTO, PAGAMENTO, DEB EM C/C, DEBITO AUTOMATICO, que quitam o saldo anterior -- normalmente o valor bate com o Saldo Anterior do resumo da fatura), estorno ou devolucao feito pelo BANCO/OPERADORA DO CARTAO, nem linhas de SUBTOTAL ou TOTAL (como Total para, Total da fatura, Total parcelados, Saldo anterior, Pagamento minimo, Limite disponivel) -- essas sao somas ou informacoes de saldo, nunca lancamentos individuais. ATENCAO a convencao de sinal negativo: em muitas faturas (ex: Bradesco), um valor seguido de hifen logo apos o numero (ex: 260,00-) significa que aquele valor e NEGATIVO, ou seja, um estorno ou credito, mesmo sem a palavra estorno aparecer escrita -- isso e diferente de um valor normal sem hifen (ex: 260,00). Quando encontrar uma linha assim, INCLUA ela normalmente como lancamento (com o valor sempre positivo no campo val) mas marque o campo estorno como true. Nao tente decidir sozinho se ela cancela outra cobranca da fatura, so marque estorno=true nessa linha especifica e deixe o calculo de cancelamento para o sistema. Para uma cobranca normal (sem o hifen), nao preencha o campo estorno ou deixe false. Nunca ignore esse hifen nem deixe de incluir a linha so porque ela parece um estorno. Atencao: um estabelecimento pode ter a palavra credito/credit no PROPRIO NOME do produto (ex: OpenAI Credit, Uber Credits) -- isso E uma compra normal e deve ser incluido; a regra de excluir credito vale so para credito/estorno dado pelo BANCO, nunca pelo nome do produto comprado. Em caso de duvida se uma linha e um pagamento da fatura ou uma compra, prefira NAO incluir e marque confianca baixa se incluir mesmo assim. Atencao com lancamentos em moeda estrangeira: quando uma linha mostrar valor em dolar (US$) e tambem o valor final em reais (R$), isso e UM SO lancamento -- extraia so o valor final em R$, nunca extraia o valor em US$ como se fosse um segundo lancamento em reais. Seja literal: nunca invente valores, datas ou descricoes que nao estejam claramente no documento. Se um campo nao estiver claro, marque confianca baixa nesse lancamento em vez de adivinhar. ATENCAO a parcelamento, isso acontece com frequencia nessa fatura e nao pode ser ignorado: e comum uma linha mostrar um numero de parcela logo apos o nome do estabelecimento, no formato NN/NN (ex: 01/06, 11/12, 03/03) -- as vezes com espaco antes (ex: SABRINA ROSA ESTE 11/12, BenjaminStore 10/10), as vezes colado direto no nome sem espaco nenhum (ex: TRENTO MAT CONST I 01/06, MERCADOLIVRE*E5DIGIT01/02). Sempre que um numero nesse formato NN/NN aparecer logo apos o nome do estabelecimento e antes da cidade ou do valor, preencha parcela_atual com o primeiro numero e parcela_total com o segundo -- nao deixe de preencher so porque o numero esta colado no nome sem espaco, isso e comum e nao significa que faz parte do nome do estabelecimento. So deixe os campos de parcela vazios quando a linha genuinamente nao mostrar nenhum numero de parcela. Quando escrever texto em portugues (como o campo motivo_ilegivel), use acentuacao correta do portugues do Brasil, comece frases com letra maiuscula e termine com pontuacao adequada.',
      messages: [{
        role: 'user',
        content: [
          conteudoDocumento,
          { type: 'text', text: 'Extraia todos os lancamentos (compras, pagamentos, taxas) deste documento financeiro usando a ferramenta registrar_lancamentos.' }
        ]
      }],
      tools: [toolSchema],
      tool_choice: { type: 'tool', name: 'registrar_lancamentos' }
    };

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY_FATURA,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      return new Response(JSON.stringify({ error: 'Falha ao processar com IA', detalhe: errText.slice(0, 500) }), { status: 502, headers: jsonHeaders });
    }

    const data = await anthropicResp.json();
    const toolUse = (data.content || []).find(b => b.type === 'tool_use' && b.name === 'registrar_lancamentos');
    if (!toolUse) {
      return new Response(JSON.stringify({ error: 'IA nao retornou lancamentos estruturados' }), { status: 502, headers: jsonHeaders });
    }

    await _iaUsoRegistrar(env, userId, 'fatura', data.usage || null);

    // usage incluido na resposta so para medicao de custo durante a validacao inicial desta funcao
    // (tokens de entrada incluem o PDF processado como imagem, tokens de saida sao a lista de lancamentos)
    const resultado = Object.assign({}, toolUse.input, { _usage: data.usage || null });
    return new Response(JSON.stringify(resultado), { headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Falha ao processar o documento' }), { status: 500, headers: jsonHeaders });
  }
}

async function handleGcalEvents(request, env, origin) {
  const corsOrigin = origin;
  const jsonHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin };
  try {
    const body = await request.json();
    const icsUrl = (body.icsUrl || '').trim();
    const from = (body.from || '').trim();
    const to = (body.to || '').trim();
    if (!icsUrl || !/^https:\/\//.test(icsUrl)) {
      return new Response(JSON.stringify({ error: 'URL do feed invalida' }), { status: 400, headers: jsonHeaders });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return new Response(JSON.stringify({ error: 'Periodo invalido' }), { status: 400, headers: jsonHeaders });
    }
    const icsResp = await fetch(icsUrl, { headers: { 'User-Agent': 'AzimoApp/1.0' } });
    if (!icsResp.ok) {
      return new Response(JSON.stringify({ error: 'Nao foi possivel acessar o feed da agenda' }), { status: 502, headers: jsonHeaders });
    }
    const icsText = await icsResp.text();
    const eventos = parseICS(icsText, from, to, 300);
    return new Response(JSON.stringify({ eventos }), { headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Falha ao processar a agenda' }), { status: 500, headers: jsonHeaders });
  }
}

// Parser ICS minimalista, sem dependencias externas. Suporta: VEVENT simples,
// eventos de dia inteiro (VALUE=DATE), TZID e Z (UTC), e expansao de RRULE
// (FREQ=DAILY/WEEKLY/MONTHLY/YEARLY com INTERVAL/COUNT/UNTIL), com limite de
// seguranca de ocorrencias. RRULE com BYDAY combinado ou outra regra mais
// complexa cai no fallback de so' incluir a primeira ocorrencia, sem quebrar.

function unfoldICS(text) {
  const rawLines = text.replace(/\r\n/g, '\n').split('\n');
  const lines = [];
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else if (line.length) {
      lines.push(line);
    }
  }
  return lines;
}

function parseICSLine(line) {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;
  const left = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const [name, ...paramParts] = left.split(';');
  const params = {};
  paramParts.forEach(p => {
    const eq = p.indexOf('=');
    if (eq !== -1) params[p.slice(0, eq)] = p.slice(eq + 1);
  });
  return { name: name.toUpperCase(), params, value };
}

function tzOffsetMs(tzid, utcGuessMs) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tzid, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const parts = fmt.formatToParts(new Date(utcGuessMs));
    const get = t => Number(parts.find(p => p.type === t).value);
    let h = get('hour'); if (h === 24) h = 0;
    const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'));
    return asIfUtc - utcGuessMs;
  } catch (e) {
    return 0;
  }
}

function parseDT(value, params) {
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(value)) {
    const y = +value.slice(0, 4), mo = +value.slice(4, 6), d = +value.slice(6, 8);
    return { allDay: true, utcMs: Date.UTC(y, mo - 1, d, 0, 0, 0), tzid: null };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const utcGuess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  if (z === 'Z') return { allDay: false, utcMs: utcGuess, tzid: 'UTC' };
  if (params.TZID) {
    const off = tzOffsetMs(params.TZID, utcGuess);
    return { allDay: false, utcMs: utcGuess - off, tzid: params.TZID };
  }
  return { allDay: false, utcMs: utcGuess, tzid: null };
}

function detectOrigem(loc, desc, url) {
  const blob = ((loc || '') + ' ' + (desc || '') + ' ' + (url || '')).toLowerCase();
  if (blob.includes('zoom.us')) return 'Zoom';
  if (blob.includes('meet.google.com')) return 'Google Meet';
  if (blob.includes('teams.microsoft.com')) return 'Microsoft Teams';
  return 'Google Agenda';
}

function dayKeyFromUtcMs(utcMs) {
  const d = new Date(utcMs);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

function parseRRule(rruleValue) {
  const out = {};
  rruleValue.split(';').forEach(p => {
    const [k, v] = p.split('=');
    if (k) out[k.toUpperCase()] = v;
  });
  return out;
}

function expandOccurrences(startMs, endMs, rrule, exdates, fromMs, toMs, maxOcorrencias) {
  const durMs = (endMs != null ? endMs - startMs : 0);
  if (!rrule) {
    if (startMs >= fromMs && startMs < toMs) return [{ startMs, endMs }];
    return [];
  }
  const freq = rrule.FREQ;
  const interval = Math.max(1, parseInt(rrule.INTERVAL || '1', 10) || 1);
  const count = rrule.COUNT ? parseInt(rrule.COUNT, 10) : null;
  let untilMs = null;
  if (rrule.UNTIL) {
    const u = parseDT(rrule.UNTIL, {});
    if (u) untilMs = u.utcMs;
  }
  // Bug reportado pelo Anderson (30/09/2026, agenda pessoal dele -- eventos mensais
  // como "Recebimento" que se repetem todo mes): antes, so' DAILY e WEEKLY eram
  // expandidos de verdade. MONTHLY e YEARLY caiam no fallback de "so' a primeira
  // ocorrencia" -- e como a primeira ocorrencia de um evento recorrente mensal
  // criado ha meses/anos quase nunca cai dentro da janela de +-3/21 dias que o
  // Azimo busca, o evento nunca aparecia, em dia nenhum. Agora MONTHLY/YEARLY
  // avancam por mes/ano de calendario de verdade (nao por dias fixos), com o dia
  // do mes grudado no dia original e tosquiado pro ultimo dia do mes quando ele
  // nao existe (ex.: dia 31 original cai em 28/29 de fevereiro).
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') {
    const results = [];
    if (startMs >= fromMs && startMs < toMs) results.push({ startMs, endMs });
    return results;
  }
  const origDate = new Date(startMs);
  const origDay = origDate.getUTCDate();
  function ocorrenciaN(n) {
    if (freq === 'DAILY') return startMs + n * interval * 86400000;
    if (freq === 'WEEKLY') return startMs + n * interval * 7 * 86400000;
    if (freq === 'MONTHLY') {
      const totalMeses = origDate.getUTCFullYear() * 12 + origDate.getUTCMonth() + n * interval;
      const y = Math.floor(totalMeses / 12), mo = totalMeses % 12;
      const ultimoDiaDoMes = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
      return Date.UTC(y, mo, Math.min(origDay, ultimoDiaDoMes), origDate.getUTCHours(), origDate.getUTCMinutes(), origDate.getUTCSeconds());
    }
    // YEARLY
    const y = origDate.getUTCFullYear() + n * interval;
    const ultimoDiaDoMes = new Date(Date.UTC(y, origDate.getUTCMonth() + 1, 0)).getUTCDate();
    return Date.UTC(y, origDate.getUTCMonth(), Math.min(origDay, ultimoDiaDoMes), origDate.getUTCHours(), origDate.getUTCMinutes(), origDate.getUTCSeconds());
  }
  // Terceiro bug encontrado na mesma revisao preventiva (30/09/2026): o loop
  // sempre comecava contando a partir da PRIMEIRA ocorrencia da serie inteira
  // (n=0), com um limite de seguranca fixo de "maxOcorrencias" iteracoes no
  // total. Pra uma serie recorrente antiga -- por exemplo uma aula semanal
  // criada ha mais de 40 semanas, tipo a "PILATES SABRINA" que ja aparece na
  // agenda do Anderson -- essas iteracoes se esgotavam contando ocorrencias
  // passadas, MUITO antes de sequer alcancar a janela de busca atual (+-3/21
  // dias). O evento sumia da Agenda pra sempre, silenciosamente, so' por a
  // serie ser "velha" o bastante -- o mesmo efeito do bug do MONTHLY, so' que
  // batendo em DAILY/WEEKLY tambem, mais cedo ou mais tarde. Agora calcula
  // direto (sem iterar do zero) uma estimativa de qual ocorrencia cai perto do
  // COMECO da janela de busca, e so' a partir dali conta as proximas
  // "maxOcorrencias" -- o limite de seguranca passa a proteger contra uma
  // janela de busca gigante, nao contra a idade da serie.
  let nEstimado = 0;
  if (freq === 'DAILY') {
    nEstimado = Math.floor((fromMs - startMs) / (interval * 86400000));
  } else if (freq === 'WEEKLY') {
    nEstimado = Math.floor((fromMs - startMs) / (interval * 7 * 86400000));
  } else {
    // MONTHLY/YEARLY: estima pela diferenca de meses ate' a janela, ignorando o
    // dia (o -1 de folga logo abaixo cobre a imprecisao disso).
    const de = new Date(fromMs);
    const mesesOrig = origDate.getUTCFullYear() * 12 + origDate.getUTCMonth();
    const mesesAlvo = de.getUTCFullYear() * 12 + de.getUTCMonth();
    const passoEmMeses = freq === 'MONTHLY' ? interval : interval * 12;
    nEstimado = Math.floor((mesesAlvo - mesesOrig) / passoEmMeses);
  }
  const nInicio = Math.max(0, nEstimado - 1);
  const results = [];
  for (let n = nInicio; n < nInicio + maxOcorrencias; n++) {
    if (count != null && n >= count) break;
    const occMs = ocorrenciaN(n);
    if (untilMs != null && occMs > untilMs) break;
    if (occMs >= toMs) break;
    if (occMs >= fromMs && !(exdates || []).includes(dayKeyFromUtcMs(occMs))) {
      results.push({ startMs: occMs, endMs: occMs + durMs });
    }
  }
  return results;
}

function parseICS(icsText, fromDateKey, toDateKey, maxEventos) {
  const lines = unfoldICS(icsText);
  const fromMs = Date.UTC(...fromDateKey.split('-').map((x, i) => i === 1 ? x - 1 : +x));
  const toMs = Date.UTC(...toDateKey.split('-').map((x, i) => i === 1 ? x - 1 : +x)) + 86400000;
  const events = [];
  let cur = null;
  for (const rawLine of lines) {
    const l = parseICSLine(rawLine);
    if (!l) continue;
    if (l.name === 'BEGIN' && l.value === 'VEVENT') { cur = { exdates: [] }; continue; }
    if (l.name === 'END' && l.value === 'VEVENT') {
      if (cur) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    if (l.name === 'SUMMARY') cur.summary = l.value.replace(/\\,/g, ',').replace(/\\n/gi, ' ').replace(/\\\\/g, '\\');
    else if (l.name === 'LOCATION') cur.location = l.value.replace(/\\,/g, ',');
    else if (l.name === 'DESCRIPTION') cur.description = l.value.replace(/\\,/g, ',').replace(/\\n/gi, ' ');
    else if (l.name === 'URL') cur.url = l.value;
    else if (l.name === 'UID') cur.uid = l.value;
    else if (l.name === 'DTSTART') cur.dtstart = parseDT(l.value, l.params);
    else if (l.name === 'DTEND') cur.dtend = parseDT(l.value, l.params);
    else if (l.name === 'RRULE') cur.rrule = parseRRule(l.value);
    else if (l.name === 'EXDATE') { const ex = parseDT(l.value, l.params); if (ex) cur.exdates.push(dayKeyFromUtcMs(ex.utcMs)); }
    else if (l.name === 'RECURRENCE-ID') cur.recurrenceId = parseDT(l.value, l.params);
    else if (l.name === 'STATUS' && l.value === 'CANCELLED') cur.cancelled = true;
  }

  const overridesPorUid = {};
  for (const ev of events) {
    if (ev.recurrenceId && ev.uid) {
      if (!overridesPorUid[ev.uid]) overridesPorUid[ev.uid] = [];
      overridesPorUid[ev.uid].push(ev);
    }
  }

  const out = [];
  for (const ev of events) {
    if (ev.cancelled || !ev.dtstart || ev.recurrenceId) continue;
    const instantesSubstituidos = ev.uid && overridesPorUid[ev.uid]
      ? new Set(overridesPorUid[ev.uid].map(o => o.recurrenceId.utcMs))
      : null;
    const occs = expandOccurrences(
      ev.dtstart.utcMs,
      ev.dtend ? ev.dtend.utcMs : null,
      ev.rrule, ev.exdates, fromMs, toMs, 40
    );
    for (const occ of occs) {
      // Essa ocorrencia foi movida ou cancelada (existe um VEVENT com RECURRENCE-ID
      // apontando exatamente pra ela) -- a versao valida, se houver, entra abaixo,
      // vinda do proprio VEVENT avulso.
      if (instantesSubstituidos && instantesSubstituidos.has(occ.startMs)) continue;
      out.push({
        uid: ev.uid || null,
        titulo: ev.summary || '(sem titulo)',
        diaInteiro: !!ev.dtstart.allDay,
        inicioUtc: new Date(occ.startMs).toISOString(),
        fimUtc: occ.endMs != null ? new Date(occ.endMs).toISOString() : null,
        origem: detectOrigem(ev.location, ev.description, ev.url),
        local: ev.location || null,
      });
      if (out.length >= maxEventos) return out;
    }
  }
  // Ocorrencias avulsas com RECURRENCE-ID: se foi cancelada, ela so' desaparece
  // (ja foi removida da serie acima); senao, entra com o horario/titulo novos.
  for (const ev of events) {
    if (!ev.recurrenceId || !ev.dtstart || ev.cancelled) continue;
    if (ev.dtstart.utcMs < fromMs || ev.dtstart.utcMs >= toMs) continue;
    out.push({
      uid: ev.uid || null,
      titulo: ev.summary || '(sem titulo)',
      diaInteiro: !!ev.dtstart.allDay,
      inicioUtc: new Date(ev.dtstart.utcMs).toISOString(),
      fimUtc: ev.dtend ? new Date(ev.dtend.utcMs).toISOString() : null,
      origem: detectOrigem(ev.location, ev.description, ev.url),
      local: ev.location || null,
    });
    if (out.length >= maxEventos) return out;
  }
  return out;
}


// ─── PUSH: verifica tarefas com horario batendo agora e dispara (item 112) ───
// Roda a cada 5 minutos (cron separado do diario de reengajamento). Mesma
// janela de tolerancia (0 a 5 min depois do horario) que o app ja usa no
// lado do cliente pra esse mesmo aviso -- aqui e' so' a versao que funciona
// com o app fechado de verdade.

function _b64urlToBytes(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function _bytesToB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function _concatBytes(arrays) {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

async function _hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

// Assina o JWT VAPID (RFC8292) que prova pro servico de push (Google/Mozilla/
// Apple) que quem esta mandando e' o Azimo -- sem isso o push e' rejeitado.
async function _gerarVapidJWT(aud, env) {
  const header = { typ: 'JWT', alg: 'ES256' };
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const payload = { aud, exp, sub: 'mailto:dasilvaandersonduarte@gmail.com' };
  const encHeader = _bytesToB64url(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = _bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = encHeader + '.' + encPayload;

  const pubBytes = _b64urlToBytes(env.VAPID_PUBLIC_KEY);
  const x = pubBytes.slice(1, 33), y = pubBytes.slice(33, 65);
  const jwk = {
    kty: 'EC', crv: 'P-256',
    x: _bytesToB64url(x), y: _bytesToB64url(y),
    d: env.VAPID_PRIVATE_KEY,
    ext: true
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput));
  return signingInput + '.' + _bytesToB64url(new Uint8Array(sigBuf));
}

// Criptografa o conteudo do aviso do jeito que o padrao aes128gcm (RFC8291)
// exige -- o servico de push nunca ve o texto puro, so quem tem a chave
// privada do aparelho (o proprio navegador do usuario) consegue abrir.
async function _criptografarPayload(payloadObj, p256dhB64, authB64) {
  const plaintext = new TextEncoder().encode(JSON.stringify(payloadObj));
  const uaPublicBytes = _b64urlToBytes(p256dhB64);
  const authSecret = _b64urlToBytes(authB64);

  const asKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', asKeyPair.publicKey));

  const uaPublicKey = await crypto.subtle.importKey('raw', uaPublicBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPublicKey }, asKeyPair.privateKey, 256));

  const ikmInfo = _concatBytes([new TextEncoder().encode('WebPush: info\0'), uaPublicBytes, asPublicRaw]);
  const ikm = await _hkdf(authSecret, sharedSecret, ikmInfo, 32);

  const salt16 = crypto.getRandomValues(new Uint8Array(16));
  const cek = await _hkdf(salt16, ikm, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await _hkdf(salt16, ikm, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

  const record = _concatBytes([plaintext, new Uint8Array([2])]);
  const cekKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cekKey, record));

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const keyIdLen = new Uint8Array([asPublicRaw.length]);

  return _concatBytes([salt16, recordSize, keyIdLen, asPublicRaw, cipher]);
}

async function _enviarPush(sub, payloadObj, env) {
  const aud = new URL(sub.endpoint).origin;
  const jwt = await _gerarVapidJWT(aud, env);
  const body = await _criptografarPayload(payloadObj, sub.p256dh, sub.auth_key);

  const resp = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`
    },
    body
  });

  // 404/410 = inscricao nao existe mais (desinstalou, revogou) -- limpa do
  // banco pra nao tentar mandar pra um aparelho que nao vai receber nunca mais
  if (resp.status === 404 || resp.status === 410) {
    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
        method: 'DELETE',
        headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY }
      });
    } catch (e) {}
  }
  return resp.ok;
}

// Item 271 do Backlog Mestre: texto humano pra antecedencia configuravel do lembrete,
// espelha _fmtAntecedenciaTexto do index.html (client) pra manter o mesmo tom em
// qualquer um dos dois caminhos (push real aqui, ou local quando o app esta aberto).
const LEMBRETE_UNIDADES = {minuto:1,hora:60,dia:1440,semana:10080,mes:0,ano:0};
function _configLembreteWorker(t){
  if(t.lembreteConfig===null || (t.lembreteConfig===undefined && t.lembreteAntecedencia===null))return null;
  const c=t.lembreteConfig;
  if(c && Object.hasOwn(LEMBRETE_UNIDADES,c.unidade) && Number.isInteger(Number(c.quantidade)) && Number(c.quantidade)>=0 && Number(c.quantidade)<=99)
    return {quantidade:Number(c.quantidade),unidade:c.unidade};
  const min=Number(t.lembreteAntecedencia||0);
  for(const [unit,mul] of [['semana',10080],['dia',1440],['hora',60],['minuto',1]])
    if(min>=mul && min%mul===0 && min/mul<=99)return {quantidade:min/mul,unidade:unit};
  return {quantidade:0,unidade:'minuto'};
}
function _instanteLembreteWorker(data,hora,cfg){
  if(!cfg||!/^\d{4}-\d{2}-\d{2}$/.test(data)||!/^\d{2}:\d{2}$/.test(hora))return NaN;
  const [y,m,d]=data.split('-').map(Number),[h,mi]=hora.split(':').map(Number);
  if(m<1||m>12||h>23||mi>59)return NaN;
  const original=new Date(Date.UTC(y,m-1,d,h,mi));
  if(original.getUTCFullYear()!==y||original.getUTCMonth()!==m-1||original.getUTCDate()!==d)return NaN;
  if(cfg.unidade==='mes'||cfg.unidade==='ano'){
    const total=y*12+m-1-(cfg.unidade==='mes'?cfg.quantidade:cfg.quantidade*12);
    const ty=Math.floor(total/12),tm=((total%12)+12)%12;
    return Date.UTC(ty,tm,Math.min(d,new Date(Date.UTC(ty,tm+1,0)).getUTCDate()),h,mi);
  }
  return original.getTime()-cfg.quantidade*LEMBRETE_UNIDADES[cfg.unidade]*60000;
}
function _fmtAntecedenciaTextoWorker(cfg,hora){
  const n=cfg.quantidade;
  if(!n)return 'esta marcado para agora, as '+hora+'.';
  const plural={minuto:['minuto','minutos'],hora:['hora','horas'],dia:['dia','dias'],semana:['semana','semanas'],mes:['mes','meses'],ano:['ano','anos']};
  return 'comeca em '+n+' '+plural[cfg.unidade][n===1?0:1]+', as '+hora+'.';
}

async function verificarEDispararPush(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return;

  const fmtData = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false, hourCycle:'h23' });
  const agora = new Date();
  const hoje = fmtData.format(agora);
  const [hh, mm] = fmtHora.format(agora).split(':').map(Number);
  const minutosAgora = hh * 60 + mm;
  const [cy,cm,cd]=hoje.split('-').map(Number);
  const agoraCalendario=Date.UTC(cy,cm-1,cd,hh,mm);

  let subs = [];
  try {
    const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/push_subscriptions?select=user_id,endpoint,p256dh,auth_key`, {
      headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY }
    });
    if (!resp.ok) { console.error('push: falha ao buscar push_subscriptions', resp.status, await resp.text()); return; }
    subs = await resp.json();
  } catch (e) { console.error('push: erro ao buscar push_subscriptions', e.message); return; }
  console.log('push: inscricoes encontradas =', subs.length);
  if (!subs.length) return;

  const userIds = [...new Set(subs.map(s => s.user_id))];
  const subsPorUsuario = {};
  subs.forEach(s => { (subsPorUsuario[s.user_id] ||= []).push(s); });

  let estados = [];
  try {
    const idsFiltro = userIds.map(id => `"${id}"`).join(',');
    const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/user_state?user_id=in.(${idsFiltro})&select=user_id,state`, {
      headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY }
    });
    if (!resp.ok) { console.error('push: falha ao buscar user_state', resp.status, await resp.text()); return; }
    estados = await resp.json();
  } catch (e) { console.error('push: erro ao buscar user_state', e.message); return; }
  console.log('push: estados encontrados =', estados.length, 'hoje =', hoje, 'minutosAgora =', minutosAgora);

  async function processarLista(row, tarefas, dataRefTarefa){
    for(const t of tarefas||[]){
      if(!t.hora||t.feito)continue;
      const cfg=_configLembreteWorker(t);
      if(!cfg)continue;
      const alvo=_instanteLembreteWorker(dataRefTarefa,String(t.hora),cfg);
      if(!Number.isFinite(alvo))continue;
      const diff=Math.floor((agoraCalendario-alvo)/60000);
      if(diff<0||diff>5)continue;
      const chave=row.user_id+'_'+dataRefTarefa+'_'+t.id+'_'+t.hora+'_'+cfg.quantidade+'_'+cfg.unidade;
      let jaEnviado=false;
      try{
        const insResp=await fetch(`${env.SUPABASE_URL}/rest/v1/push_enviados`,{
          method:'POST',
          headers:{'apikey':env.SUPABASE_SERVICE_KEY,'Authorization':'Bearer '+env.SUPABASE_SERVICE_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
          body:JSON.stringify({chave,user_id:row.user_id})
        });
        if(!insResp.ok)jaEnviado=true;
      }catch(e){jaEnviado=true}
      if(jaEnviado)continue;
      const payload={titulo:'Sua Agenda · Azimo',corpo:(t.texto||'Você tem uma tarefa')+' '+_fmtAntecedenciaTextoWorker(cfg,t.hora),url:'/'};
      for(const sub of subsPorUsuario[row.user_id]||[]){
        try{await _enviarPush(sub,payload,env)}catch(e){console.error('push: falha no envio',e.message)}
      }
    }
  }
  for(const row of estados){
    const todas=(row.state||{}).tarefasHoje||{};
    for(const [data,tarefas] of Object.entries(todas))
      await processarLista(row,tarefas,data);
  }
}
