-- Enable Row Level Security on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to select their own profile
CREATE POLICY "Select own profile" ON profiles
FOR SELECT USING (id = auth.uid());

-- Policy: Allow users to update their own profile
CREATE POLICY "Update own profile" ON profiles
FOR UPDATE USING (id = auth.uid()); 