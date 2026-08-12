import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';

async function dump() {
    try {
        await mongoose.connect(uri);
        const plans = await mongoose.connection.collection('plans').find({}).limit(5).toArray();
        console.log(JSON.stringify(plans, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

dump();
