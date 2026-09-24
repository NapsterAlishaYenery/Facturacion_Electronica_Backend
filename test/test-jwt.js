//test-jwt.js (temporal)
require('dotenv').config();

const {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
} = require('../src/shared/utils/jwt');

const {
    hashPassword,
    comparePassword,
    checkPasswordStrength
} = require('../src/shared/utils/password');

(async () => {
    console.log('--- JWT Tests ---');
    const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        role: 'admin',
        companyId: null
    };

    const accessToken = signAccessToken(payload);
    console.log('Access token:', accessToken.substring(0, 50) + '...');

    const refreshToken = signRefreshToken({ userId: payload.userId });
    console.log('Refresh token:', refreshToken.substring(0, 50) + '...');

    const decoded = verifyAccessToken(accessToken);
    console.log('Decoded access token:', decoded);

    const decodedRefresh = verifyRefreshToken(refreshToken);
    console.log('Decoded refresh token:', decodedRefresh);

    // Probar que un access token NO sirve como refresh
    try {
        verifyRefreshToken(accessToken);
        console.log('❌ Should have failed');
    } catch (error) {
        console.log('✅ Access token rejected as refresh:', error.message);
    }

    console.log('\n--- Password Tests ---');
    const plain = 'MySecurePass123';
    const hash = await hashPassword(plain);
    console.log('Hash:', hash.substring(0, 30) + '...');
    console.log('Length:', hash.length);

    const isMatch = await comparePassword(plain, hash);
    console.log('Correct password:', isMatch ? '✅ Match' : '❌ Fail');

    const isWrong = await comparePassword('WrongPass', hash);
    console.log('Wrong password:', isWrong ? '❌ Should fail' : '✅ Correctly rejected');

    console.log('\n--- Strength Test ---');
    console.log('Weak pass:', checkPasswordStrength('abc'));
    console.log('Strong pass:', checkPasswordStrength('MySecurePass123'));
})();