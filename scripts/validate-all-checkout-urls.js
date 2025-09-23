/**
 * Script para validar todas as URLs de checkout dos produtos no site
 * Verifica se cada URL retorna uma resposta válida (não 404 ou erro)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configurações
const DELAY_BETWEEN_REQUESTS = 1000; // 1 segundo entre requests para não sobrecarregar
const TIMEOUT = 10000; // 10 segundos de timeout
const MAX_RETRIES = 2; // Máximo de tentativas por URL

/**
 * Faz uma requisição HTTP/HTTPS e retorna o status
 */
function checkUrl(url) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'HEAD', // Usa HEAD para ser mais rápido
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    const req = client.request(options, (res) => {
      resolve({
        status: res.statusCode,
        valid: res.statusCode >= 200 && res.statusCode < 400,
        error: null
      });
    });

    req.on('error', (error) => {
      resolve({
        status: null,
        valid: false,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: null,
        valid: false,
        error: 'Timeout'
      });
    });

    req.end();
  });
}

/**
 * Verifica uma URL com retry
 */
async function checkUrlWithRetry(url, retries = MAX_RETRIES) {
  for (let i = 0; i <= retries; i++) {
    const result = await checkUrl(url);
    
    if (result.valid || i === retries) {
      return {
        ...result,
        attempts: i + 1
      };
    }
    
    // Aguarda antes de tentar novamente
    if (i < retries) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }
  }
}

/**
 * Delay entre requisições
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Carrega todos os produtos e suas URLs
 */
function loadProductUrls() {
  try {
    // Carrega o mapeamento de variant IDs
    const mappingPath = path.join(__dirname, '../data/shopify_variant_mapping.json');
    const variantMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

    // Carrega os produtos unificados para obter mais informações
    const unifiedPath = path.join(__dirname, '../data/unified_products_en_gbp.json');
    let unifiedProducts = [];
    
    if (fs.existsSync(unifiedPath)) {
      const unifiedData = JSON.parse(fs.readFileSync(unifiedPath, 'utf-8'));
      unifiedProducts = unifiedData.products || [];
    }

    // Gera as URLs de checkout
    const productUrls = [];
    
    for (const [handle, variantId] of Object.entries(variantMapping)) {
      // Encontra o produto unificado correspondente
      const unifiedProduct = unifiedProducts.find(p => p.handle === handle);
      
      const productData = {
        handle,
        variantId,
        title: unifiedProduct ? unifiedProduct.title : handle,
        checkoutUrl: `https://ae888e.myshopify.com/cart/${variantId}:1`,
        directUrl: `https://tpsperfumeshop.shop/cart/${variantId}:1`
      };
      
      productUrls.push(productData);
    }

    return productUrls;
  } catch (error) {
    console.error('❌ Erro ao carregar produtos:', error);
    return [];
  }
}

/**
 * Função principal de validação
 */
async function validateAllUrls() {
  console.log('🔍 Iniciando validação de todas as URLs de checkout...\n');
  
  const products = loadProductUrls();
  
  if (products.length === 0) {
    console.log('❌ Nenhum produto encontrado para validar');
    return;
  }

  console.log(`📊 Total de produtos a validar: ${products.length}`);
  console.log(`⏱️  Tempo estimado: ~${Math.ceil(products.length * DELAY_BETWEEN_REQUESTS / 1000 / 60)} minutos\n`);

  const results = {
    valid: [],
    invalid: [],
    errors: [],
    summary: {
      total: products.length,
      validCount: 0,
      invalidCount: 0,
      errorCount: 0
    }
  };

  // Valida cada URL
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const progress = `[${i + 1}/${products.length}]`;
    
    console.log(`${progress} Verificando: ${product.handle}`);
    
    // Verifica a URL principal (myshopify.com)
    const mainResult = await checkUrlWithRetry(product.checkoutUrl);
    
    // Verifica a URL direta (domínio personalizado) 
    const directResult = await checkUrlWithRetry(product.directUrl);
    
    const productResult = {
      ...product,
      mainUrl: {
        url: product.checkoutUrl,
        ...mainResult
      },
      directUrl: {
        url: product.directUrl,
        ...directResult
      },
      overallValid: mainResult.valid || directResult.valid
    };

    // Categoriza o resultado
    if (productResult.overallValid) {
      results.valid.push(productResult);
      results.summary.validCount++;
      console.log(`   ✅ Válida (Main: ${mainResult.status}, Direct: ${directResult.status})`);
    } else if (mainResult.error || directResult.error) {
      results.errors.push(productResult);
      results.summary.errorCount++;
      console.log(`   ❌ Erro (Main: ${mainResult.error || mainResult.status}, Direct: ${directResult.error || directResult.status})`);
    } else {
      results.invalid.push(productResult);
      results.summary.invalidCount++;
      console.log(`   ⚠️  Inválida (Main: ${mainResult.status}, Direct: ${directResult.status})`);
    }

    // Delay entre requisições (exceto na última)
    if (i < products.length - 1) {
      await delay(DELAY_BETWEEN_REQUESTS);
    }
  }

  // Salva os resultados
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, '../reports/url-validation-report.json');
  const summaryPath = path.join(__dirname, '../reports/url-validation-summary.txt');
  
  // Cria a pasta reports se não existir
  const reportsDir = path.dirname(reportPath);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Salva relatório completo
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  // Gera resumo em texto
  const summary = `
RELATÓRIO DE VALIDAÇÃO DE URLs DE CHECKOUT
==========================================
Data: ${new Date().toLocaleString('pt-BR')}
Total de produtos: ${results.summary.total}

RESUMO:
✅ URLs válidas: ${results.summary.validCount} (${(results.summary.validCount/results.summary.total*100).toFixed(1)}%)
⚠️  URLs inválidas: ${results.summary.invalidCount} (${(results.summary.invalidCount/results.summary.total*100).toFixed(1)}%)
❌ Erros: ${results.summary.errorCount} (${(results.summary.errorCount/results.summary.total*100).toFixed(1)}%)

${results.invalid.length > 0 ? `
URLS INVÁLIDAS:
${results.invalid.map(p => `- ${p.handle} (${p.variantId})`).join('\n')}
` : ''}

${results.errors.length > 0 ? `
URLS COM ERRO:
${results.errors.map(p => `- ${p.handle}: ${p.mainUrl.error || p.directUrl.error}`).join('\n')}
` : ''}

PRIMEIRAS 10 URLs VÁLIDAS:
${results.valid.slice(0, 10).map(p => `✅ ${p.handle}: ${p.checkoutUrl}`).join('\n')}
`;

  fs.writeFileSync(summaryPath, summary);

  // Exibe resumo no console
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DA VALIDAÇÃO');
  console.log('='.repeat(60));
  console.log(`✅ URLs válidas: ${results.summary.validCount}/${results.summary.total} (${(results.summary.validCount/results.summary.total*100).toFixed(1)}%)`);
  console.log(`⚠️  URLs inválidas: ${results.summary.invalidCount}/${results.summary.total} (${(results.summary.invalidCount/results.summary.total*100).toFixed(1)}%)`);
  console.log(`❌ Erros: ${results.summary.errorCount}/${results.summary.total} (${(results.summary.errorCount/results.summary.total*100).toFixed(1)}%)`);
  
  console.log(`\n📁 Relatórios salvos:`);
  console.log(`   • Completo: ${reportPath}`);
  console.log(`   • Resumo: ${summaryPath}`);

  if (results.invalid.length > 0) {
    console.log(`\n⚠️  URLs inválidas encontradas:`);
    results.invalid.slice(0, 5).forEach(p => {
      console.log(`   • ${p.handle} (${p.variantId})`);
    });
    if (results.invalid.length > 5) {
      console.log(`   • ... e mais ${results.invalid.length - 5} URLs`);
    }
  }

  console.log('\n✅ Validação concluída!');
}

// Executa a validação
validateAllUrls().catch(error => {
  console.error('❌ Erro na validação:', error);
  process.exit(1);
});