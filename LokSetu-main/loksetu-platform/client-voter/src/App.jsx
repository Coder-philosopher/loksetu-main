import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Vote from './pages/VotingBooth.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ElectionVote from './pages/ElectionVote.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vote/:electionId" element={<ElectionVote />} />
        <Route path="/vote" element={<Vote />} />
      </Routes>
    </Router>
  );
}

export default App;