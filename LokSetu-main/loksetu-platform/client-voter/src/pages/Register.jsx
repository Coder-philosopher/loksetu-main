import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  Loader2,
  Save,
  ScanFace,
  Search,
  User,
  IdCard,
  Building2,
  MapPin,
  Lock,
} from 'lucide-react';
import FaceLivenessCam from '../components/FaceLivenessCam';
import { DELHI_ELECTORAL_DATA } from '../data/delhiElectoralData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const Register = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    epicId: '',
    password: '',
    confirmPassword: '',
    homeState: 'Delhi',
    vidhanSabha: '',
    lokSabha: '',
    mcdWard: '',
  });
  const [errors, setErrors] = useState({});
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', message: 'Fill details and capture a live face photo.' });
  const [vidhanSearch, setVidhanSearch] = useState('');
  const [wardSearch, setWardSearch] = useState('');

  const vidhanOptions = DELHI_ELECTORAL_DATA.vidhan_sabha;
  const filteredVidhan = useMemo(() => {
    const q = vidhanSearch.trim().toLowerCase();
    if (!q) return vidhanOptions;
    return vidhanOptions.filter((item) => item.name.toLowerCase().includes(q));
  }, [vidhanSearch, vidhanOptions]);

  const selectedVidhan = useMemo(
    () => vidhanOptions.find((item) => item.name === formData.vidhanSabha) || null,
    [vidhanOptions, formData.vidhanSabha]
  );

  const filteredWards = useMemo(() => {
    if (!selectedVidhan) return [];
    const q = wardSearch.trim().toLowerCase();
    if (!q) return selectedVidhan.mcd_wards;
    return selectedVidhan.mcd_wards.filter((ward) => ward.toLowerCase().includes(q));
  }, [selectedVidhan, wardSearch]);

  const vidhanSuggestions = useMemo(() => {
    if (!vidhanSearch.trim()) return [];
    return filteredVidhan.slice(0, 8);
  }, [vidhanSearch, filteredVidhan]);

  const wardSuggestions = useMemo(() => {
    if (!wardSearch.trim() || !selectedVidhan) return [];
    return filteredWards.slice(0, 8);
  }, [wardSearch, filteredWards, selectedVidhan]);

  const validate = () => {
    const nextErrors = {};
    if (!formData.firstName.trim()) nextErrors.firstName = 'First name is required.';
    if (!formData.lastName.trim()) nextErrors.lastName = 'Last name is required.';
    if (!/^[A-Z]{3}\d{6,7}$/i.test(formData.epicId.trim())) {
      nextErrors.epicId = 'EPIC ID must be 3 letters + 6-7 digits.';
    }
    if (!formData.password || formData.password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }
    if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }
    if (!formData.vidhanSabha) nextErrors.vidhanSabha = 'Select a Vidhan Sabha constituency.';
    if (!formData.lokSabha) nextErrors.lokSabha = 'Lok Sabha constituency is required.';
    if (!formData.mcdWard) nextErrors.mcdWard = 'Select an MCD ward.';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const startCamera = () => {
    if (!validate()) return;
    setCameraActive(true);
    setStatus({ type: 'loading', message: 'Camera activated. Complete liveness verification.' });
  };

  const handleCapture = (imageSrc) => {
    if (!imageSrc) {
      setStatus({ type: 'error', message: 'Capture failed. Please retry.' });
      return;
    }
    setCapturedImage(imageSrc);
    setCameraActive(false);
    setStatus({ type: 'success', message: 'Live biometric capture completed.' });
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (!capturedImage) {
      setStatus({ type: 'error', message: 'Capture a live photo before submitting.' });
      return;
    }

    setSubmitting(true);
    setStatus({ type: 'loading', message: 'Submitting registration request...' });

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/register-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          epicId: formData.epicId.trim().toUpperCase(),
          password: formData.password.trim(),
          homeState: 'Delhi',
          vidhanSabha: formData.vidhanSabha,
          lokSabha: formData.lokSabha,
          mcdWard: formData.mcdWard,
          base64Image: capturedImage,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setStatus({ type: 'success', message: data.message || 'Registration request submitted.' });
        setTimeout(() => navigate('/'), 1800);
      } else {
        setStatus({ type: 'error', message: data.message || 'Request failed. Please try again.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: `Network error: ${error.message}` });
     } finally {
       setSubmitting(false);
     }
   };

   const onSelectVidhan = (value) => {
     const selected = vidhanOptions.find((item) => item.name === value);
     setFormData((prev) => ({
       ...prev,
       vidhanSabha: value,
       lokSabha: selected?.lok_sabha || '',
       mcdWard: '',
     }));
     setWardSearch('');
   };

   return (
     <div className="min-h-screen bg-gov-grey font-gov text-gov-text">
       <div className="h-1.5 bg-gradient-to-r from-gov-saffron via-white to-gov-green" />

       <header className="bg-gov-blue text-white">
         <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
           <div>
             <h1 className="text-lg font-bold tracking-tight">Voter Registration</h1>
             <p className="text-xs text-blue-200 font-medium">Delhi Elections - Request Enrollment</p>
           </div>
           <button
             onClick={() => navigate('/')}
             className="flex items-center gap-2 px-3 py-2 text-xs font-bold border border-white/20 rounded hover:bg-white/10"
           >
             <ArrowLeft size={14} /> Back to Login
           </button>
         </div>
       </header>

       <main className="max-w-6xl mx-auto px-6 py-8">
         <div className="gov-card overflow-hidden">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
             <section className="p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-gov-border">
               <h2 className="text-xl font-bold mb-1">Registration Details</h2>
               <p className="text-xs text-gov-text-light mb-6">
                 Only Delhi address mapping is supported. Use dropdown and search, no free-text address entry.
               </p>

               <form onSubmit={submitRequest} className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                     <label className="text-xs font-bold text-gov-text-light uppercase tracking-wide">First Name</label>
                     <div className="relative mt-1">
                       <User size={14} className="absolute left-3 top-3 text-gov-text-light" />
                       <input
                         value={formData.firstName}
                         onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                         className="w-full pl-9 pr-3 py-2.5 border border-gov-border rounded text-sm"
                         placeholder="First name"
                       />
                     </div>
                     {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
                   </div>

                   <div>
                     <label className="text-xs font-bold text-gov-text-light uppercase tracking-wide">Last Name</label>
                     <div className="relative mt-1">
                       <User size={14} className="absolute left-3 top-3 text-gov-text-light" />
                       <input
                         value={formData.lastName}
                         onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                         className="w-full pl-9 pr-3 py-2.5 border border-gov-border rounded text-sm"
                         placeholder="Last name"
                       />
                     </div>
                     {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
                   </div>
                 </div>

                 <div>
                   <label className="text-xs font-bold text-gov-text-light uppercase tracking-wide">EPIC ID</label>
                   <div className="relative mt-1">
                     <IdCard size={14} className="absolute left-3 top-3 text-gov-text-light" />
                     <input
                       value={formData.epicId}
                       onChange={(e) => setFormData((prev) => ({ ...prev, epicId: e.target.value }))}
                       className="w-full pl-9 pr-3 py-2.5 border border-gov-border rounded text-sm uppercase tracking-wide"
                       placeholder="ABC1234567"
                     />
                   </div>
                   {errors.epicId && <p className="text-xs text-red-600 mt-1">{errors.epicId}</p>}
                 </div>

                 <div>
                   <label className="text-xs font-bold text-gov-text-light uppercase tracking-wide">Password</label>
                   <div className="relative mt-1">
                     <Lock size={14} className="absolute left-3 top-3 text-gov-text-light" />
                     <input
                       type="password"
                       value={formData.password}
                       onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                       className="w-full pl-9 pr-3 py-2.5 border border-gov-border rounded text-sm"
                       placeholder="Min 6 characters"
                     />
                   </div>
                   {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
                 </div>

                 <div>
                   <label className="text-xs font-bold text-gov-text-light uppercase tracking-wide">Confirm Password</label>
                   <div className="relative mt-1">
                     <Lock size={14} className="absolute left-3 top-3 text-gov-text-light" />
                     <input
                       type="password"
                       value={formData.confirmPassword}
                       onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                       className="w-full pl-9 pr-3 py-2.5 border border-gov-border rounded text-sm"
                       placeholder="Confirm password"
                     />
                   </div>
                   {errors.confirmPassword && <p className="text-xs text-red-600 mt-1">{errors.confirmPassword}</p>}
                 </div>

                 <div>
                   <label className="text-xs font-bold text-gov-text-light uppercase tracking-wide">State</label>
                   <div className="mt-1 px-3 py-2.5 border border-gov-border rounded text-sm bg-gray-50">Delhi</div>
                 </div>

                 <div>
                   <label className="text-xs font-bold text-gov-text-light uppercase tracking-wide">Search Vidhan Sabha</label>
                   <div className="relative mt-1">
                     <Search size={14} className="absolute left-3 top-3 text-gov-text-light" />
                     <input
                       value={vidhanSearch}
                       onChange={(e) => setVidhanSearch(e.target.value)}
                       className="w-full pl-9 pr-3 py-2.5 border border-gov-border rounded text-sm"
                       placeholder="Type to filter constituency"
                     />
                   </div>
                   {vidhanSuggestions.length > 0 && (
                     <div className="mt-2 border border-gov-border rounded bg-white max-h-40 overflow-auto">
                       {vidhanSuggestions.map((item) => (
                         <button
                           key={item.name}
                           type="button"
                           onClick={() => {
                             onSelectVidhan(item.name);
                             setVidhanSearch(item.name);
                           }}
                           className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gov-border last:border-b-0"
                         >
                           <span className="font-medium text-gov-text">{item.name}</span>
                           <span className="ml-2 text-xs text-gov-text-light">({item.lok_sabha})</span>
                         </button>
                       ))}
                     </div>
                   )}
                 </div>

                 <div>
                   <label className="text-xs font-bold text-gov-text-light uppercase tracking-wide">Vidhan Sabha</label>
                   <select
                     value={formData.vidhanSabha}
                     onChange={(e) => onSelectVidhan(e.target.value)}
                     className="w-full mt-1 px-3 py-2.5 border border-gov-border rounded text-sm bg-white"
                   >
                     <option value="">Select Vidhan Sabha</option>
                     {filteredVidhan.map((item) => (
                       <option key={item.name} value={item.name}>{item.name}</option>
                     ))}
                   </select>
                   {errors.vidhanSabha && <p className="text-xs text-red-600 mt-1">{errors.vidhanSabha}</p>}
                 </div>

                 <div>
                   <label className="text-xs font-bold text-gov-text-light uppercase tracking-wide">Lok Sabha</label>
                   <div className="relative mt-1">
                     <Building2 size={14} className="absolute left-3 top-3 text-gov-text-light" />
                     <input
                       value={formData.lokSabha}
                       readOnly
                       className="w-full pl-9 pr-3 py-2.5 border border-gov-border rounded text-sm bg-gray-50"
                       placeholder="Auto-selected from Vidhan Sabha"
                     />
                   </div>
                   {errors.lokSabha && <p className="text-xs text-red-600 mt-1">{errors.lokSabha}</p>}
                 </div>

                 <div>
                   <label className="text-xs font-bold text-gov-text-light uppercase tracking-wide">Search MCD Ward</label>
                   <div className="relative mt-1">
                     <Search size={14} className="absolute left-3 top-3 text-gov-text-light" />
                     <input
                       value={wardSearch}
                       onChange={(e) => setWardSearch(e.target.value)}
                       disabled={!selectedVidhan}
                       className="w-full pl-9 pr-3 py-2.5 border border-gov-border rounded text-sm disabled:bg-gray-50"
                       placeholder={selectedVidhan ? 'Type to filter ward list' : 'Select Vidhan Sabha first'}
                     />
                   </div>
                   {wardSuggestions.length > 0 && (
                     <div className="mt-2 border border-gov-border rounded bg-white max-h-40 overflow-auto">
                       {wardSuggestions.map((ward) => (
                         <button
                           key={ward}
                           type="button"
                           onClick={() => {
                             setFormData((prev) => ({ ...prev, mcdWard: ward }));
                             setWardSearch(ward);
                           }}
                           className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gov-border last:border-b-0"
                         >
                           {ward}
                         </button>
                       ))}
                     </div>
                   )}
                 </div>

                 <div>
                   <label className="text-xs font-bold text-gov-text-light uppercase tracking-wide">MCD Ward</label>
                   <div className="relative mt-1">
                     <MapPin size={14} className="absolute left-3 top-3 text-gov-text-light" />
                     <select
                       value={formData.mcdWard}
                       onChange={(e) => setFormData((prev) => ({ ...prev, mcdWard: e.target.value }))}
                       disabled={!selectedVidhan}
                       className="w-full pl-9 pr-3 py-2.5 border border-gov-border rounded text-sm bg-white disabled:bg-gray-50"
                     >
                       <option value="">Select MCD Ward</option>
                       {filteredWards.map((ward) => (
                         <option key={ward} value={ward}>{ward}</option>
                       ))}
                     </select>
                   </div>
                   {errors.mcdWard && <p className="text-xs text-red-600 mt-1">{errors.mcdWard}</p>}
                 </div>

                 <div className="pt-2 flex items-center gap-2">
                   <button
                     type="button"
                     onClick={startCamera}
                     className="gov-btn-secondary text-sm"
                     disabled={submitting}
                   >
                     <Camera size={16} /> {capturedImage ? 'Retake Live Photo' : 'Capture Live Photo'}
                   </button>
                   <button
                     type="submit"
                     className="gov-btn-primary text-sm"
                     disabled={submitting || !capturedImage}
                   >
                     {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                     {submitting ? 'Submitting...' : 'Submit Request'}
                   </button>
                 </div>
               </form>
             </section>

             <section className="p-6 lg:p-8 bg-gray-50 flex flex-col">
               <h3 className="text-sm font-bold uppercase tracking-wide text-gov-text-light mb-3">Biometric Verification</h3>
               <div className="relative w-full aspect-square max-w-md mx-auto bg-gray-900 rounded overflow-hidden border border-gov-border">
                 {capturedImage && !cameraActive ? (
                   <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                 ) : cameraActive ? (
                   <FaceLivenessCam onCapture={handleCapture} isProcessing={submitting} />
                 ) : (
                   <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-2">
                     <ScanFace size={38} />
                     <p className="text-xs uppercase tracking-wider">Camera standby</p>
                   </div>
                 )}
               </div>

               <div className="mt-5 p-3 rounded border border-gov-border bg-white text-sm">
                 <div className="flex items-center gap-2 font-semibold">
                   {status.type === 'success' ? (
                     <CheckCircle size={15} className="text-gov-green" />
                   ) : status.type === 'loading' ? (
                     <Loader2 size={15} className="text-gov-blue animate-spin" />
                   ) : (
                     <ScanFace size={15} className="text-gov-blue" />
                   )}
                   <span>{status.message}</span>
                 </div>
               </div>
             </section>
           </div>
         </div>
       </main>
     </div>
   );
 };

 export default Register;
