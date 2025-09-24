/**
 * Sistema de checkout ultra-simples
 * Sempre usa a loja WIFI MONEY (loja 2)
 */

// Configuração fixa da loja 2
const STORE_CONFIG = {
  name: 'WIFI MONEY',
  domain: 'tpsfragrances.shop',
  storefrontAccessToken: process.env.SHOPIFY_STORE_2_STOREFRONT_TOKEN || 'token_placeholder'
};

interface CartItem {
  shopifyId: string;
  quantity: number;
}

/**
 * Cria URL de checkout usando nossa API route (evita CORS)
 * Sempre usa a loja 3 (SADERSTORE)
 */
export async function createSimpleCheckoutUrl(items: CartItem[]): Promise<string | null> {
  try {
    if (!items || items.length === 0) {
      console.warn('❌ Nenhum item para checkout');
      return null;
    }

    console.log('🛒 Criando checkout simples para', items.length, 'itens');
    console.log('🏪 Usando loja:', STORE_CONFIG.name);

    // Fazer requisição para nossa API route
    const response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    });
    
    if (!response.ok) {
      console.error('❌ Erro HTTP:', response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    console.log('📦 Resposta da API:', data);
    
    if (data.error) {
      console.error('❌ Erro da API:', data.error);
      return null;
    }
    
    if (!data.checkoutUrl) {
      console.error('❌ URL de checkout não encontrada');
      return null;
    }
    
    console.log('✅ Checkout criado com sucesso:', data.checkoutUrl);
    return data.checkoutUrl;
    
  } catch (error) {
    console.error('❌ Erro ao criar checkout:', error);
    return null;
  }
}

/**
 * Função de compatibilidade - sempre retorna a configuração da loja 3
 */
export function getStoreConfig() {
  return STORE_CONFIG;
}