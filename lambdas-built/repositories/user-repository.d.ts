import { User } from '../types';
export default class UserRepository {
    private tableName;
    constructor();
    create(user: User): Promise<void>;
    findById(userId: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    update(userId: string, updates: Partial<User>): Promise<void>;
}
//# sourceMappingURL=user-repository.d.ts.map