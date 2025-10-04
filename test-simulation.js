#!/usr/bin/env node

/**
 * Shopping Cart API Integration Test
 *
 * This script simulates full user workflows to test:
 * 1. Cart creation
 * 2. Product addition
 * 3. Cart retrieval
 * 4. Product removal
 * 5. Cart confirmation/cancellation
 * 6. Error handling
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

// API client
async function apiCall(method, endpoint, data = null, headers = {}) {
    const url = `${baseUrl}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    log(`🔄 ${method} ${endpoint}`, 'blue');

    const response = await fetch(url, options);
    const responseData = await response.json();

    if (!response.ok) {
        log(`❌ ${method} ${endpoint} failed: ${response.status}`, 'red');
        log(`Response: ${JSON.stringify(responseData)}`, 'red');
        throw new Error(`API call failed: ${response.status}`);
    }

    log(`✅ ${method} ${endpoint} success`, 'green');
    return { status: response.status, data: responseData };
}

// Test scenarios
async function testCartCreation() {
    log('\n🧪 Testing cart creation...', 'yellow');

    const result = await apiCall('POST', '/carts', {});

    assert(result.data.id, 'Cart should have an ID');
    assert(result.data.customerId, 'Cart should have a customer ID');
    assert(result.data.status === 'Opened', 'Cart status should be Opened');
    assert(result.data.revision, 'Cart should have a revision');

    return result.data;
}

async function testCartRetrieval(cartId) {
    log('\n🧪 Testing cart retrieval...', 'yellow');

    const result = await apiCall('GET', `/carts/${cartId}`);

    assert(result.data.id === cartId, 'Retrieved cart should have correct ID');
    assert(result.data.customerId, 'Retrieved cart should have customer ID');
    assert(result.data.status === 'Opened', 'Retrieved cart status should be Opened');
    assert(Array.isArray(result.data.items), 'Cart should have items array');
    assert(result.data.openedAt, 'Cart should have openedAt timestamp');

    return result.data;
}

async function testProductAddition(cartId, revision) {
    log('\n🧪 Testing product addition...', 'yellow');

    const productData = {
        productId: 'product-001',
        productName: '노트북',
        quantity: 1
    };

    const result = await apiCall('POST', `/carts/${cartId}/items`, productData, {
        'If-Match': revision
    });

    assert(result.data.message, 'Should return success message');
    assert(result.data.revision, 'Should return new revision');

    // Verify item was added by retrieving cart
    const cartResult = await apiCall('GET', `/carts/${cartId}`);
    const cart = cartResult.data;

    assert(cart.items.length === 1, 'Cart should have 1 item');
    assert(cart.items[0].productId === 'product-001', 'Item should have correct product ID');
    assert(cart.items[0].productName === '노트북', 'Item should have correct product name');
    assert(cart.items[0].quantity === 1, 'Item should have correct quantity');
    assert(cart.items[0].unitPrice === 29.99, 'Item should have correct unit price');

    return { revision: result.data.revision, cart };
}

async function testProductAdditionSameItem(cartId, revision) {
    log('\n🧪 Testing adding same product again (should increase quantity)...', 'yellow');

    const productData = {
        productId: 'product-001',
        productName: '노트북',
        quantity: 1
    };

    const result = await apiCall('POST', `/carts/${cartId}/items`, productData, {
        'If-Match': revision
    });

    // Verify quantity increased
    const cartResult = await apiCall('GET', `/carts/${cartId}`);
    const cart = cartResult.data;

    assert(cart.items.length === 1, 'Cart should still have 1 unique item');
    assert(cart.items[0].quantity === 2, 'Item quantity should be 2');

    return { revision: result.data.revision, cart };
}

async function testProductAdditionDifferentItem(cartId, revision) {
    log('\n🧪 Testing adding different product...', 'yellow');

    const productData = {
        productId: 'product-002',
        productName: '마우스',
        quantity: 1
    };

    const result = await apiCall('POST', `/carts/${cartId}/items`, productData, {
        'If-Match': revision
    });

    // Verify new item added
    const cartResult = await apiCall('GET', `/carts/${cartId}`);
    const cart = cartResult.data;

    assert(cart.items.length === 2, 'Cart should have 2 different items');

    const notebook = cart.items.find(item => item.productId === 'product-001');
    const mouse = cart.items.find(item => item.productId === 'product-002');

    assert(notebook && notebook.quantity === 2, 'Notebook should still have quantity 2');
    assert(mouse && mouse.quantity === 1, 'Mouse should have quantity 1');

    return { revision: result.data.revision, cart };
}

async function testProductRemoval(cartId, revision) {
    log('\n🧪 Testing product removal...', 'yellow');

    const result = await apiCall('DELETE', `/carts/${cartId}/items/product-001`, { quantity: 1 }, {
        'If-Match': revision
    });

    // Verify item quantity decreased
    const cartResult = await apiCall('GET', `/carts/${cartId}`);
    const cart = cartResult.data;

    const notebook = cart.items.find(item => item.productId === 'product-001');
    assert(notebook && notebook.quantity === 1, 'Notebook quantity should decrease to 1');
    assert(cart.items.length === 2, 'Cart should still have 2 items');

    return { revision: result.data.revision, cart };
}

async function testProductCompleteRemoval(cartId, revision) {
    log('\n🧪 Testing complete product removal...', 'yellow');

    const result = await apiCall('DELETE', `/carts/${cartId}/items/product-001`, { quantity: 1 }, {
        'If-Match': revision
    });

    // Verify item completely removed
    const cartResult = await apiCall('GET', `/carts/${cartId}`);
    const cart = cartResult.data;

    const notebook = cart.items.find(item => item.productId === 'product-001');
    assert(!notebook, 'Notebook should be completely removed');
    assert(cart.items.length === 1, 'Cart should have 1 item left');

    const mouse = cart.items.find(item => item.productId === 'product-002');
    assert(mouse && mouse.quantity === 1, 'Mouse should still be there');

    return { revision: result.data.revision, cart };
}

async function testCartConfirmation(cartId, revision) {
    log('\n🧪 Testing cart confirmation...', 'yellow');

    const result = await apiCall('POST', `/carts/${cartId}/confirm`, {}, {
        'If-Match': revision
    });

    // Verify cart is confirmed
    const cartResult = await apiCall('GET', `/carts/${cartId}`);
    const cart = cartResult.data;

    assert(cart.status === 'Confirmed', 'Cart status should be Confirmed');
    assert(cart.confirmedAt, 'Cart should have confirmedAt timestamp');

    return { revision: result.data.revision, cart };
}

async function testCartCancellation() {
    log('\n🧪 Testing cart cancellation...', 'yellow');

    // Create a new cart for cancellation test
    const createResult = await apiCall('POST', '/carts', {});
    const cartId = createResult.data.id;
    const revision = createResult.data.revision;

    const result = await apiCall('POST', `/carts/${cartId}/cancel`, {}, {
        'If-Match': revision
    });

    // Verify cart is cancelled
    const cartResult = await apiCall('GET', `/carts/${cartId}`);
    const cart = cartResult.data;

    assert(cart.status === 'Cancelled', 'Cart status should be Cancelled');
    assert(cart.cancelledAt, 'Cart should have cancelledAt timestamp');

    return cart;
}

async function testErrorHandling() {
    log('\n🧪 Testing error handling...', 'yellow');

    // Test non-existent cart
    try {
        await apiCall('GET', '/carts/non-existent-id');
        assert(false, 'Should throw error for non-existent cart');
    } catch (error) {
        log('✅ Correctly handles non-existent cart', 'green');
    }

    // Test invalid product addition
    const createResult = await apiCall('POST', '/carts', {});
    const cartId = createResult.data.id;

    try {
        await apiCall('POST', `/carts/${cartId}/items`, {
            productId: 'invalid-product',
            productName: 'Invalid',
            quantity: 1
        }, {
            'If-Match': createResult.data.revision
        });
        assert(false, 'Should throw error for invalid product');
    } catch (error) {
        log('✅ Correctly handles invalid product', 'green');
    }

    // Test wrong revision
    try {
        await apiCall('POST', `/carts/${cartId}/items`, {
            productId: 'product-001',
            productName: '노트북',
            quantity: 1
        }, {
            'If-Match': '999'
        });
        assert(false, 'Should throw error for wrong revision');
    } catch (error) {
        log('✅ Correctly handles wrong revision', 'green');
    }
}

async function testMultipleCartsScenario() {
    log('\n🧪 Testing multiple carts scenario...', 'yellow');

    // Create multiple carts
    const cart1Result = await apiCall('POST', '/carts', {});
    const cart2Result = await apiCall('POST', '/carts', {});

    const cart1Id = cart1Result.data.id;
    const cart2Id = cart2Result.data.id;

    // Add different items to each cart
    await apiCall('POST', `/carts/${cart1Id}/items`, {
        productId: 'product-001',
        productName: '노트북',
        quantity: 2
    }, { 'If-Match': cart1Result.data.revision });

    await apiCall('POST', `/carts/${cart2Id}/items`, {
        productId: 'product-002',
        productName: '마우스',
        quantity: 1
    }, { 'If-Match': cart2Result.data.revision });

    // Verify carts are independent
    const finalCart1 = await apiCall('GET', `/carts/${cart1Id}`);
    const finalCart2 = await apiCall('GET', `/carts/${cart2Id}`);

    assert(finalCart1.data.items.length === 1, 'Cart 1 should have 1 item type');
    assert(finalCart1.data.items[0].productId === 'product-001', 'Cart 1 should have notebook');
    assert(finalCart1.data.items[0].quantity === 2, 'Cart 1 notebook should have quantity 2');

    assert(finalCart2.data.items.length === 1, 'Cart 2 should have 1 item type');
    assert(finalCart2.data.items[0].productId === 'product-002', 'Cart 2 should have mouse');
    assert(finalCart2.data.items[0].quantity === 1, 'Cart 2 mouse should have quantity 1');

    log('✅ Multiple carts work independently', 'green');
}

// Main test runner
async function runAllTests() {
    console.clear();
    log('🚀 Starting Shopping Cart API Integration Tests\n', 'blue');

    try {
        // Test basic cart operations
        const cart = await testCartCreation();
        await testCartRetrieval(cart.id);

        // Test product operations
        let result = await testProductAddition(cart.id, cart.revision);
        result = await testProductAdditionSameItem(cart.id, result.revision);
        result = await testProductAdditionDifferentItem(cart.id, result.revision);
        result = await testProductRemoval(cart.id, result.revision);
        result = await testProductCompleteRemoval(cart.id, result.revision);

        // Test cart status changes
        await testCartConfirmation(cart.id, result.revision);
        await testCartCancellation();

        // Test error scenarios
        await testErrorHandling();

        // Test complex scenarios
        await testMultipleCartsScenario();

        log('\n🎉 All tests passed! The Shopping Cart API is working correctly.', 'green');

    } catch (error) {
        log(`\n💥 Test failed: ${error.message}`, 'red');
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
        log('Run: npm run dev', 'yellow');
        return false;
    }
}

// Run tests
(async () => {
    if (await checkServerHealth()) {
        await runAllTests();
    }
})();