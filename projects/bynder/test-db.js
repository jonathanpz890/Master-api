import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGO_URI;
console.log('Testing connection to:', uri.replace(/\/\/.*?:.*?@/, '//<user>:<pass>@'));

async function test() {
    try {
        console.log('Attempting to connect...');
        await mongoose.connect(uri, { 
            serverSelectionTimeoutMS: 5000,
            family: 4 
        });
        console.log('SUCCESS: Connected to MongoDB');
        process.exit(0);
    } catch (error) {
        console.error('FAILURE: Could not connect');
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        if (error.reason) {
            console.error('Reason:', JSON.stringify(error.reason, null, 2));
        }
        process.exit(1);
    }
}

test();
