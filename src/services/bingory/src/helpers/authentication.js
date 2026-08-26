module.exports = {
    createSession: async function(req, user, sessionTimer) {
        req.login(user, (err) => {
            if (err) {
                throw err;
            } else {
                
            }
        })
    }
}