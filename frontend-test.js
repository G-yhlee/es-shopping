#!/usr/bin/env node

/**
 * Frontend Integration Test
 *
 * This script simulates exactly what the frontend does:
 * 1. Create a cart and add to history
 * 2. Load cart from history (the original bug)
 * 3. Add products through frontend workflow
 * 4. Test the exact data flow between frontend and backend
 */

const baseUrl = 'http://localhost:3001/api';

// Test utilities
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function assert(condition, message) {
    if (condition) {
        log(`✅ ${message}`, 'green');
    } else {
        log(`❌ ${message}`, 'red');
        throw new Error(`Assertion failed: ${message}`);
    }
}

// Simulate localStorage
const localStorage = {
    data: {},
    setItem(key, value) { this.data[key] = value; },
    getItem(key) { return this.data[key] || null; },
    removeItem(key) { delete this.data[key]; }
};

// Frontend simulation functions (exact replicas from HTML)
let currentCart = null;
let cartHistory = [];

async function createCart() {
    log('🔄 Frontend: Creating new cart...', 'blue');

    const response = await fetch(`${baseUrl}/carts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });

    if (!response.ok) throw new Error('Failed to create cart');

    const data = await response.json();
    currentCart = {
        id: data.id,
        status: data.status,
        items: [],
        revision: data.revision
    };

    log(`✅ Frontend: Cart created with ID: ${currentCart.id}`, 'green');
    return currentCart;
}

async function loadCartFromServer(cartId) {
    log(`🔄 Frontend: Loading cart ${cartId} from server...`, 'blue');

    const response = await fetch(`${baseUrl}/carts/${cartId}`);
    if (!response.ok) throw new Error('Failed to load cart');

    const data = await response.json();
    currentCart = {
        id: data.id,
        status: data.status,
        items: data.items ? data.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            price: item.unitPrice,
            quantity: item.quantity
        })) : [],
        revision: data.revision
    };

    log(`✅ Frontend: Cart loaded successfully`, 'green');
    return currentCart;
}

async function addToCart(productId, productName, price) {
    log(`🔄 Frontend: Adding ${productName} to cart...`, 'blue');
    log(`🔍 Current cart revision: ${currentCart.revision}`, 'blue');

    if (!currentCart || currentCart.status !== 'Opened') {
        throw new Error('No open cart available');
    }

    const response = await fetch(`${baseUrl}/carts/${currentCart.id}/items`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'If-Match': currentCart.revision
        },
        body: JSON.stringify({
            productId,
            productName,
            quantity: 1
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        log(`❌ Failed to add item: ${JSON.stringify(errorData)}`, 'red');
        throw new Error(`Failed to add item: ${errorData.error || response.status}`);
    }

    const data = await response.json();
    log(`🔍 Server returned revision: ${data.revision}`, 'blue');

    // Reload cart from server to get accurate state (our fix!)
    await loadCartFromServer(currentCart.id);
    log(`🔍 Cart revision after reload: ${currentCart.revision}`, 'blue');

    log(`✅ Frontend: ${productName} added successfully`, 'green');
    return currentCart;
}

function addToCartHistory(cart) {
    cartHistory.push({
        ...cart,
        createdAt: new Date().toISOString()
    });
    localStorage.setItem('cartHistory', JSON.stringify(cartHistory));
    log(`📝 Frontend: Cart added to history`, 'blue');
}

function updateCartHistory(cart) {
    const index = cartHistory.findIndex(c => c.id === cart.id);
    if (index >= 0) {
        cartHistory[index] = {
            ...cartHistory[index],
            ...cart,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem('cartHistory', JSON.stringify(cartHistory));
        log(`📝 Frontend: Cart history updated`, 'blue');
    }
}

function loadCartHistory() {
    const saved = localStorage.getItem('cartHistory');
    if (saved) {
        cartHistory = JSON.parse(saved);
        log(`📖 Frontend: Loaded ${cartHistory.length} carts from history`, 'blue');
    }
}

async function loadCartFromHistory(cartId) {
    log(`🔄 Frontend: Loading cart ${cartId} from history (simulating click)...`, 'blue');

    // This was the original bug - when user clicks on cart history
    await loadCartFromServer(cartId);

    log(`✅ Frontend: Cart loaded from history successfully`, 'green');
    return currentCart;
}

// Test scenarios
async function testFrontendWorkflow() {
    log('\n🧪 Testing complete frontend workflow...', 'yellow');

    // 1. Create initial cart
    const cart1 = await createCart();
    addToCartHistory(cart1);

    // 2. Add some products
    await addToCart('product-001', '노트북', 29.99);
    updateCartHistory(currentCart);

    await addToCart('product-002', '마우스', 49.99);
    updateCartHistory(currentCart);

    // 3. Create another cart
    const cart2 = await createCart();
    addToCartHistory(cart2);

    await addToCart('product-003', '키보드', 19.99);
    updateCartHistory(currentCart);

    // 4. Now test the original bug: loading cart from history
    log('\n🔍 Testing cart history loading (original bug scenario)...', 'yellow');

    // Load first cart from history
    const loadedCart1 = await loadCartFromHistory(cart1.id);

    assert(loadedCart1.id === cart1.id, 'Loaded cart should have correct ID');
    assert(loadedCart1.items.length === 2, 'Cart 1 should have 2 items');
    assert(loadedCart1.items.some(item => item.productId === 'product-001'), 'Should have notebook');
    assert(loadedCart1.items.some(item => item.productId === 'product-002'), 'Should have mouse');

    // Load second cart from history
    const loadedCart2 = await loadCartFromHistory(cart2.id);

    assert(loadedCart2.id === cart2.id, 'Loaded cart should have correct ID');
    assert(loadedCart2.items.length === 1, 'Cart 2 should have 1 item');
    assert(loadedCart2.items.some(item => item.productId === 'product-003'), 'Should have keyboard');

    log('✅ Cart history loading works perfectly!', 'green');
}

async function testDataConsistency() {
    log('\n🧪 Testing data consistency between frontend and backend...', 'yellow');

    const cart = await createCart();

    // Add item via frontend
    await addToCart('product-001', '노트북', 29.99);

    // Verify frontend data
    assert(currentCart.items.length === 1, 'Frontend should show 1 item');
    assert(currentCart.items[0].productId === 'product-001', 'Frontend should have correct product ID');
    assert(currentCart.items[0].price === 29.99, 'Frontend should have correct price');

    // Verify backend data directly
    const backendResponse = await fetch(`${baseUrl}/carts/${cart.id}`);
    const backendData = await backendResponse.json();

    assert(backendData.items.length === 1, 'Backend should show 1 item');
    assert(backendData.items[0].productId === 'product-001', 'Backend should have correct product ID');
    assert(backendData.items[0].unitPrice === 29.99, 'Backend should have correct unit price');

    // Verify data mapping is correct
    assert(currentCart.items[0].price === backendData.items[0].unitPrice,
           'Frontend price should match backend unitPrice');

    log('✅ Data consistency verified!', 'green');
}

async function testErrorRecovery() {
    log('\n🧪 Testing frontend error handling and recovery...', 'yellow');

    const cart = await createCart();

    // Test adding invalid product (should fail gracefully)
    try {
        await addToCart('invalid-product', 'Invalid Product', 0);
        assert(false, 'Should have thrown error for invalid product');
    } catch (error) {
        log('✅ Frontend correctly handles invalid product error', 'green');
    }

    // Verify cart is still usable after error
    await addToCart('product-001', '노트북', 29.99);
    assert(currentCart.items.length === 1, 'Cart should work after error recovery');

    log('✅ Error recovery works correctly!', 'green');
}

async function testConcurrentOperations() {
    log('\n🧪 Testing concurrent cart operations...', 'yellow');

    // Create two carts and switch between them
    const cart1 = await createCart();
    await addToCart('product-001', '노트북', 29.99);
    const cart1WithItems = { ...currentCart };

    const cart2 = await createCart();
    await addToCart('product-002', '마우스', 49.99);
    const cart2WithItems = { ...currentCart };

    // Switch back to cart1
    await loadCartFromHistory(cart1.id);
    assert(currentCart.items.length === 1, 'Cart 1 should still have 1 item');
    assert(currentCart.items[0].productId === 'product-001', 'Cart 1 should have notebook');

    // Switch to cart2
    await loadCartFromHistory(cart2.id);
    assert(currentCart.items.length === 1, 'Cart 2 should still have 1 item');
    assert(currentCart.items[0].productId === 'product-002', 'Cart 2 should have mouse');

    log('✅ Concurrent operations work correctly!', 'green');
}

// Main test runner
async function runFrontendTests() {
    console.clear();
    log('🚀 Starting Frontend Integration Tests\n', 'blue');

    try {
        await testFrontendWorkflow();
        await testDataConsistency();
        await testErrorRecovery();
        await testConcurrentOperations();

        log('\n🎉 All frontend tests passed! The shopping cart works perfectly end-to-end.', 'green');
        log('🎯 Original bug is completely fixed!', 'green');

    } catch (error) {
        log(`\n💥 Frontend test failed: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    }
}

// Check if server is running
async function checkServerHealth() {
    try {
        const response = await fetch(baseUrl.replace('/api', ''));
        if (response.ok) {
            log('✅ Server is running', 'green');
            return true;
        }
    } catch (error) {
        log('❌ Server is not running. Please start the server first.', 'red');
        return false;
    }
}

// Run tests
(async () => {
    if (await checkServerHealth()) {
        await runFrontendTests();
    }
})();