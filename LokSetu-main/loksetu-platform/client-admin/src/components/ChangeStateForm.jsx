import React, { useState } from 'react';

const ChangeStateForm = () => {
  const [voterId, setVoterId] = useState('');
  const [newState, setNewState] = useState('');
  const [newConstituencyId, setNewConstituencyId] = useState(''); 
  const [regionName, setRegionName] = useState(''); // New state for visual feedback
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  // 1. YOUR NEW DATA STRUCTURE
  const CONSTITUENCY_LOOKUP = {
    'Delhi': { id: '1', region: 'North Delhi Central' },
    'Mumbai': { id: '2', region: 'Mumbai South' },
    'Bihar': { id: '3', region: 'Patna Sahib' },
    // You can add more states here easily
    'Punjab': { id: '4', region: 'Ludhiana' },
    'Karnataka': { id: '5', region: 'Bangalore South' }
  };

  const states = Object.keys(CONSTITUENCY_LOOKUP);

  // 2. UPDATED AUTO-FILL LOGIC
  const handleStateChange = (e) => {
    const selectedState = e.target.value;
    setNewState(selectedState);
    
    if (selectedState && CONSTITUENCY_LOOKUP[selectedState]) {
      const data = CONSTITUENCY_LOOKUP[selectedState];
      // We set the ID to send to Blockchain
      setNewConstituencyId(data.id); 
      // We set the Region name just to show the user (User Friendly)
      setRegionName(data.region); 
    } else {
      setNewConstituencyId('');
      setRegionName('');
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('http://localhost:3000/change-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            voterId, 
            newState, 
            newConstituencyId // Sends '1', '2', or '3' based on selection
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ Success! Moved to ${newState} (Const ID: ${newConstituencyId})`);
        setVoterId(''); 
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
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
          <label className="block text-sm font-medium text-gray-700">Voter ID</label>
          <input
            type="text"
            placeholder="e.g. V001"
            value={voterId}
            onChange={(e) => setVoterId(e.target.value)}
            className="mt-1 block w-full p-2 border border-gray-300 rounded"
          />
        </div>

        {/* State Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700">New Home State</label>
          <select
            value={newState}
            onChange={handleStateChange} 
            className="mt-1 block w-full p-2 border border-gray-300 rounded bg-white"
          >
            <option value="">-- Select State --</option>
            {states.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        {/* Auto-Filled Constituency Details */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Const. ID</label>
                <input
                    type="text"
                    value={newConstituencyId}
                    readOnly
                    className="mt-1 block w-full p-2 border bg-gray-100 rounded text-gray-800 font-mono"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Region Name</label>
                <input
                    type="text"
                    value={regionName}
                    readOnly
                    className="mt-1 block w-full p-2 border bg-gray-100 rounded text-gray-800"
                />
            </div>
        </div>

        <button
          type="submit"
          disabled={loading || !newState}
          className={`w-full text-white font-bold py-2 px-4 rounded transition-colors
            ${loading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {loading ? "Processing..." : "Transfer Voter"}
        </button>
      </form>

      {message && (
        <div className={`mt-4 p-3 rounded text-sm bg-blue-100 text-blue-700`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default ChangeStateForm;