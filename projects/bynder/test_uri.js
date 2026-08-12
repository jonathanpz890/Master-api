const ALLOWED_REDIRECT_ORIGINS = ['http://localhost:5173'];
function isValidRedirectUri(uri) {
    if (process.env.NODE_ENV !== 'production') {
        try {
            const url = new URL(uri);
            if (url.hostname === 'localhost' || url.hostname.startsWith('192.168.') || url.hostname.startsWith('10.') || url.hostname.startsWith('172.')) {
                return true;
            }
        } catch (e) {
            return false;
        }
    }
    
    if (ALLOWED_REDIRECT_ORIGINS.length === 0) return false;
    return ALLOWED_REDIRECT_ORIGINS.some(allowed => uri.startsWith(allowed));
}
console.log(isValidRedirectUri('exp://192.168.1.224:8081/--/'));
