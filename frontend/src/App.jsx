function Register(){
  const [form,setForm]=useState({firstName:'',lastName:'',gender:'Male',country:'Nigeria',phone:'',email:'',password:''});
  const [error,setError]=useState(''); const [loading,setLoading]=useState(false); const nav=useNavigate();
  const { setUser } = useContext(AuthContext);
  const strength = checkPasswordStrength(form.password);
  const isStrong = Object.values(strength).every(v=>v===true);
  const handle = (k,v) => setForm({...form,[k]:v.slice(0,100)});

  const submit=async(e)=>{
    e.preventDefault();
    if(!isStrong){ setError('Weak password - need 8+ chars, Big letter, small, number, symbol'); return; }
    if(!form.email.includes('@')){ setError('Invalid email'); return; }
    setLoading(true);
    try {
      const res=await fetch(`${API}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form, email:form.email.toLowerCase().trim()})});
      const data=await res.json();
      if(data.token){ alert('Registered! ✅'); nav('/login'); } else { setError(data.msg || 'Failed'); }
    } catch { setError('Network error'); }
    setLoading(false);
  };

  // SAME GOOGLE LOGIC AS LOGIN - ADDED NOW
  const googleLogin = async () => {
    const googleEmail = prompt('Enter Google Email:');
    if(!googleEmail || !googleEmail.includes('@') || googleEmail.length > 100) return alert('Invalid Gmail');
    try {
      const res = await fetch(`${API}/api/auth/google`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:googleEmail.toLowerCase().trim(), firstName:'Google', lastName:'User'})});
      const data = await res.json();
      if(data.token){
        localStorage.setItem('token',data.token); 
        localStorage.setItem('user',JSON.stringify(data.user)); 
        setUser(data.user); 
        nav('/');
      } else alert(data.msg || 'Google register failed');
    } catch { alert('Google login failed'); }
  };

  return (
    <form onSubmit={submit} className="form" style={{maxWidth:420, margin:'20px auto', padding:20, border:'1px solid #ddd', borderRadius:12, display:'flex', flexDirection:'column', gap:8, background:'white'}}>
      <h2>Create Account</h2>
      <div style={{display:'flex', gap:8}}><input value={form.firstName} onChange={e=>handle('firstName',e.target.value)} placeholder="First Name" required maxLength={50}/><input value={form.lastName} onChange={e=>handle('lastName',e.target.value)} placeholder="Last Name" required maxLength={50}/></div>
      <div style={{display:'flex', gap:8}}>
        <select value={form.gender} onChange={e=>handle('gender',e.target.value)} style={{flex:1, padding:8}}><option>Male</option><option>Female</option><option>Other</option></select>
        <input value={form.country} onChange={e=>handle('country',e.target.value)} placeholder="Country" required maxLength={50} style={{flex:1}}/>
      </div>
      <input value={form.phone} onChange={e=>handle('phone',e.target.value)} placeholder="Phone +234..." required maxLength={20}/>
      <input value={form.email} onChange={e=>handle('email',e.target.value)} placeholder="Email" required type="email" maxLength={100}/>
      <input type="password" value={form.password} onChange={e=>handle('password',e.target.value)} placeholder="Password" required maxLength={100}/>
      {form.password && (
        <div style={{fontSize:'12px', lineHeight:'1.6'}}>
          <div style={{color: strength.length ? 'green' : 'red'}}>{strength.length ? '✅' : '❌'} 8+ chars</div>
          <div style={{color: strength.upper ? 'green' : 'red'}}>{strength.upper ? '✅' : '❌'} Uppercase</div>
          <div style={{color: strength.lower ? 'green' : 'red'}}>{strength.lower ? '✅' : '❌'} lowercase</div>
          <div style={{color: strength.number ? 'green' : 'red'}}>{strength.number ? '✅' : '❌'} Number</div>
          <div style={{color: strength.special ? 'green' : 'red'}}>{strength.special ? '✅' : '❌'} Special !@#$%</div>
        </div>
      )}
      {error && <p style={{color:'red', fontSize:13}}>{error}</p>}
      <button disabled={!isStrong || loading} style={{opacity: isStrong ? 1 : 0.5, background: isStrong ? 'black' : '#888', color:'white', padding:10, borderRadius:6, cursor: isStrong ? 'pointer' : 'not-allowed'}}>{loading?'Creating...': isStrong ? 'Register ✅' : 'Weak Password ❌'}</button>
      
      {/* GOOGLE BUTTON ADDED HERE - SAME AS LOGIN */}
      <div style={{textAlign:'center', color:'#888', fontSize:13, marginTop:5}}>OR</div>
      <button type="button" onClick={googleLogin} style={{width:'100%', background:'white', color:'#444', border:'1px solid #ccc', padding:'10px', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', gap:10, fontWeight:600, cursor:'pointer'}}>
        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="google" style={{width:20, height:20}} />
        Continue with Google
      </button>
    </form>
  )
}