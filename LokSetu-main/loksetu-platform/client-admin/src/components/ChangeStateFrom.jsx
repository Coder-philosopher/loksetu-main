import React, { useState } from 'react';

const ChangeStateForm = () => {
  const [voterId, setVoterId] = useState('');
  const [newState, setNewState] = useState('');
  const [message, setMessage] = useState(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const states = ["Delhi", "Mumbai", "Bihar"];

  const handleTransfer = async (e) => {
    e.preventDefault();
    setMessage(null);
    setIsError(false);

    if (!voterId || !newState) {
      setIsError(true);
      setMessage("Please enter a Voter ID and select a State.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/change-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId, newState })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ Success! ${data.message}`);
        setVoterId(''); // Clear input
        setNewState('');
      } else {
        setIsError(true);
        setMessage(`❌ Error: ${data.error || 'Transfer failed'}`);
      }
    } catch (error) {
      setIsError(true);
      setMessage(`❌ Network Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full border border-gray-200">
      <h2 className="text-xl font-bold mb-4 text-gray-800">🌍 Voter Relocation Tool</h2>
      
      <form onSubmit={handleTransfer} className="space-y-4">
        {/* Voter ID Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Voter ID (EPIC)</label>
          <input
            type="text"
            placeholder="e.g. V001"
            value={voterId}
            onChange={(e) => setVoterId(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* State Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700">New Home State</label>
          <select
            value={newState}
            onChange={(e) => setNewState(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded bg-white"
          >
            <option value="">-- Select State --</option>
            {states.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full text-white font-bold py-2 px-4 rounded transition-colors
            ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {loading ? "Processing Transfer..." : "Transfer Voter"}
        </button>
      </form>

      {/* Status Message */}
      {message && (
        <div className={`mt-4 p-3 rounded text-sm ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default ChangeStateForm;