// app/(auth)/login/page.jsx
'use client';

import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegistering) {
        await signup(email, password);
        toast.success('Account created successfully! Please login.');
        setIsRegistering(false);
      } else {
        await login(email, password);
        toast.success('Logged in successfully!');
        router.push('/dashboard');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-rich-black p-4">
      <div className="bg-deep-navy p-8 rounded-lg shadow-xl w-full max-w-md border border-primary-gold">
        <h1 className="text-3xl font-bold text-cream-white mb-6 text-center">
          {isRegistering ? 'Register' : 'Login'}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-cream-white text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              className="shadow appearance-none border border-dark-charcoal rounded w-full py-3 px-4 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-cream-white text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="shadow appearance-none border border-dark-charcoal rounded w-full py-3 px-4 bg-rich-black text-cream-white leading-tight focus:outline-none focus:shadow-outline focus:border-secondary-gold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Processing...' : (isRegistering ? 'Register' : 'Login')}
          </button>
        </form>
        <div className="mt-6 text-center text-cream-white">
          {isRegistering ? (
            <p>
              Already have an account?{' '}
              <button
                onClick={() => setIsRegistering(false)}
                className="text-secondary-gold hover:underline focus:outline-none"
              >
                Login
              </button>
            </p>
          ) : (
            <p>
             Dont have an account? Please Whatsapp 📲 +27828408141
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
