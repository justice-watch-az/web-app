const { supabase } = require('./supabase');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class SupabaseAuth {
  constructor() {
    this.useSupabase = !!supabase;
  }

  async signUp(email, password, name) {
    if (this.useSupabase) {
      // Use Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      });

      if (authError) throw authError;

      // Create user in our users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert([{ 
          email, 
          name,
          password: 'supabase_managed', // Placeholder since Supabase manages auth
          role: 'user'
        }])
        .select()
        .single();

      if (userError) throw userError;

      return {
        user: userData,
        session: authData.session
      };
    } else {
      // Use local auth (existing logic)
      const hashedPassword = await bcrypt.hash(password, 10);
      return { hashedPassword };
    }
  }

  async signIn(email, password) {
    if (this.useSupabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Get user details from our users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (userError) throw userError;

      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userData.id);

      return {
        user: userData,
        session: data.session
      };
    } else {
      // Return null to use existing local auth
      return null;
    }
  }

  async signOut(token) {
    if (this.useSupabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
  }

  async verifyToken(token) {
    if (this.useSupabase) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error) throw error;
      
      // Get full user details from our users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single();

      if (userError) throw userError;
      
      return userData;
    } else {
      // Use existing JWT verification
      return jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt-secret');
    }
  }

  async getSession(token) {
    if (this.useSupabase) {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    }
    return null;
  }

  // Middleware for Express
  middleware() {
    return async (req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      try {
        const user = await this.verifyToken(token);
        req.user = user;
        next();
      } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ error: 'Invalid token' });
      }
    };
  }
}

module.exports = new SupabaseAuth();