import bcrypt from 'bcryptjs';
const hash = await bcrypt.hash('Admin@12345', 12);
console.log(hash);