import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, CardContent, Typography, TextField, Button } from '@mui/material';

function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                throw new Error('Invalid credentials');
            }

            navigate('/admin/dashboard');
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
            <Card sx={{ maxWidth: 400 }}>
                <CardContent>
                    <Typography variant="h5" component="h1" textAlign="center" gutterBottom>Admin Login</Typography>
                    <form onSubmit={handleSubmit}>
                        <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} fullWidth margin="normal" />
                        <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth margin="normal" />
                        <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>Login</Button>
                        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                    </form>
                </CardContent>
            </Card>
        </Container>
    );
}

export default LoginPage;
