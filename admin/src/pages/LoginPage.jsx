import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import useAuthStore from '../hooks/useAuthStore';
import { Spinner } from '../components/common';

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  // Email form
  const { register: regEmail, handleSubmit: handleEmail, formState: { errors: emailErrors } } = useForm();

  const onEmailLogin = async ({ email, password }) => {
    const res = await login(email, password);
    if (res.success) {
      toast.success('Welcome back!');
      navigate('/');
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100 rounded-full opacity-30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-50 rounded-full opacity-40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-surface-900">Healthqube Eyes</h1>
          <p className="text-sm text-surface-500 mt-1">FieldForce Admin Panel</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleEmail(onEmailLogin)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1.5">Email</label>
                <input
                  {...regEmail('email', {
                    required: 'Email required',
                    pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                  })}
                  type="email" placeholder="you@healthqube.com" className="input" />
                {emailErrors.email && <p className="text-xs text-red-500 mt-1">{emailErrors.email.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1.5">Password</label>
                <input
                  {...regEmail('password', { required: 'Password required', minLength: { value: 6, message: 'Min 6 chars' } })}
                  type="password" placeholder="••••••••" className="input" />
                {emailErrors.password && <p className="text-xs text-red-500 mt-1">{emailErrors.password.message}</p>}
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
                {isLoading ? <Spinner size="sm" /> : null}
                Sign In
              </button>
          </form>
        </div>

        <p className="text-center text-xs text-surface-400 mt-6">
          Healthqube Eyes · Smart FieldForce System
        </p>
      </div>
    </div>
  );
}
