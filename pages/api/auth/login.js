import { comparePassword, generateToken } from '../../../lib/auth';

const dummyUser = {
  id: 'user123',
  email: 'test@example.com',
  // Paste the hashed password you just generated here
  password: '$2b$10$MUtXMKXdUmqUz5NI3uavxeVoIVCNLwu3N1XydeUykweMJAqWbO0zq'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (email !== dummyUser.email || !comparePassword(password, dummyUser.password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = generateToken(dummyUser.id);
  return res.status(200).json({ token });
}
