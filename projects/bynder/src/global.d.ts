import { User as AppUser } from '../db/models/User.model.js';

declare global {
    namespace Express {
        interface User extends AppUser {
            _id: any;
        }
        interface Request {
            user?: User;
            file?: any;
            isAuthenticated(): boolean;
            logout(done: (err: any) => void): void;
        }
    }
}
