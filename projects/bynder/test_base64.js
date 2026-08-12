const stateObj = { redirect_uri: 'exp://192.168.1.224:8081/--/' };
const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
console.log('Original Base64:', state);
const stateWithSpaces = state.replace(/\+/g, ' ');
try {
    const parsed = JSON.parse(Buffer.from(stateWithSpaces, 'base64').toString());
    console.log('Parsed with spaces:', parsed);
} catch (e) {
    console.log('Error parsing with spaces:', e.message);
}
