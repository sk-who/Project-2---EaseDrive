import { comparePassword, generateToken } from '../../../lib/auth';

const dummyUser = {
  email: 'test@example.com',
  password: '$2a$10$abcd...', // Hashed version of 'password'
  id: 'user123',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body;

  if (email !== dummyUser.email || !comparePassword(password, dummyUser.password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = generateToken(dummyUser.id);
  res.status(200).json({ token });
}