import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import './App.css';

const API = import.meta.env.VITE_API_URL || 'https://esosa-fullstack.onrender.com';
const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_KEY;

const AuthContext = createContext();
const CartContext = createContext();
const WishlistContext = createContext();

function ProtectedRoute({ children, adminOnly }){
  const { user } = useContext(AuthContext);
  if(!user) return <Navigate to="/login" replace />;
  if(adminOnly && user.isAdmin !== true) return <h2 style={{padding:30}}>❌ Admin Only</h2>;
  return children;
}

function checkPasswordStrength(pwd){
  return {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[!@#$%^&*]/.test(pwd),
  };
}
const sanitize = (str) => {
  if(!str) return '';
  return String(str).replace(/[<>\"']/g, '').trim().slice(0, 100);
};

const getFirstImage = (p) => {
  if(p?.images && p.images.length) return p.images[0];
  return p?.image || '';
};
const getAllImages = (p) => {
  if(p?.images && p.images.length) return p.images;
  if(p?.image) return [p.image];
  return [];
};
const resolveImg = (img) => {
  if(!img) return '';
  if(img.startsWith('http')) return img;
  if(img.startsWith('/uploads')) return `${API}${img}`;
  return img;
};

function Store(){
  const [products,setProducts] = useState([]);
  const [search,setSearch] = useState('');
  const [category,setCategory] = useState('All');
  const { addToCart } = useContext(CartContext);
  const { wishlist, toggleWishlist } = useContext(WishlistContext);
  
  const fetchProducts = async () => {
    try {
      const q = `?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`;
      const res = await fetch(`${API}/api/products${q}`);
      const data = await res.json();
      if(!Array.isArray(data)) return;
      const unique = [...new Map(data.map(p => [p.name, p])).values()];
      setProducts(unique);
    } catch { setProducts([]); }
  };
  useEffect(()=>{ fetchProducts(); },[search, category]);
  const categories = ['All','phones','laptops','shirts','watches','headphones','gaming','accessories'];
  
  return (
    <div style={{padding:20}}>
      <div style={{display:'flex', gap:10, marginBottom:20, flexWrap:'wrap'}}>
        <input value={search} onChange={e=>setSearch(e.target.value.slice(0,50))} placeholder="🔍 Search products..." style={{padding:12, width:300, borderRadius:10, border:'1px solid #ccc', fontSize:16}} maxLength={50}/>
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{padding:12, borderRadius:10, fontSize:16}}>
          {categories.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <Link to="/wishlist" style={{padding:'12px 18px', background:'#ffefef', borderRadius:10, textDecoration:'none', color:'black', fontWeight:'bold'}}>❤️ Wishlist ({wishlist.length})</Link>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:18}}>
        {products.map(p=>{
          const first = getFirstImage(p);
          const allCount = getAllImages(p).length;
          return (
          <div key={p._id} style={{border:'1px solid #ddd', padding:14, borderRadius:14, background:'white', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', position:'relative'}}>
            <button onClick={()=>toggleWishlist(p)} style={{position:'absolute', top:10, right:10, background:'white', border:'1px solid #ddd', borderRadius:20, width:34, height:34, cursor:'pointer', zIndex:2}}>
              {wishlist.find(w=>w._id===p._id) ? '❤️' : '🤍'}
            </button>
            {allCount>1 && <span style={{position:'absolute', top:10, left:10, background:'black', color:'white', fontSize:10, padding:'3px 6px', borderRadius:6, zIndex:2}}>{allCount} IMAGES</span>}
            <Link to={`/product/${p._id}`} style={{textDecoration:'none', color:'inherit'}}>
              <img src={resolveImg(first)} onError={(e)=> e.target.style.display='none'} style={{width:'100%', height:180, objectFit:'cover', borderRadius:10}} alt={sanitize(p.name)} />
              <span style={{fontSize:11, background:'#eee', padding:'3px 8px', borderRadius:6}}>{sanitize(p.category)}</span>
              <h3 style={{margin:'8px 0', color:'black', fontSize:16}}>{sanitize(p.name)}</h3>
              <div style={{display:'flex', alignItems:'center', gap:6, fontSize:13}}>
                <span style={{color:'gold'}}>★ {(p.rating||4.5).toFixed(1)}</span>
                <span style={{color:'#888'}}>({p.reviews?.length || 5} reviews)</span>
              </div>
              <p style={{fontSize:13, color:'#555', minHeight:20, margin:'6px 0'}}>{sanitize(p.description)?.slice(0,50) || 'Quality product'}...</p>
              <p style={{fontSize:18, color:'black', margin:'6px 0'}}><b>${Number(p.price) || 0}</b> <span style={{fontSize:12, color:'green'}}>• In Stock</span></p>
            </Link>
            <button onClick={()=>addToCart(p)} style={{width:'100%', padding:12, background:'black', color:'white', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:'bold'}}>Add to Cart</button>
          </div>
        )})}
      </div>
    </div>
  );
}

function ProductDetails(){
  const { id } = useParams();
  const [product,setProduct]=useState(null);
  const [related,setRelated]=useState([]);
  const [qty,setQty]=useState(1);
  const [activeImg,setActiveImg]=useState(0);
  const [reviewText,setReviewText]=useState('');
  const [reviews,setReviews]=useState([]);
  const { addToCart } = useContext(CartContext);
  const { toggleWishlist, wishlist } = useContext(WishlistContext);
  const nav = useNavigate();
  const isWish = wishlist.find(w=>w._id===id);

  useEffect(()=>{
    const fetchOne = async () => {
      try {
        let res = await fetch(`${API}/api/products/${id}`);
        let data = res.ok ? await res.json() : null;
        if(!data?._id){
          let res2 = await fetch(`${API}/api/products`);
          let all = await res2.json();
          data = all.find(p=>p._id===id);
        }
        if(data){ setProduct(data); setActiveImg(0); setReviews(data.reviews || [{user:'John D.', rating:5, text:'Great product! Fast delivery'}, {user:'Sarah', rating:4, text:'Good quality for price'}]); }
        let res3 = await fetch(`${API}/api/products`);
        let allProducts = await res3.json();
        setRelated(allProducts.filter(p=>p._id!==id).slice(0,4));
      } catch {}
    };
    fetchOne();
  },[id]);

  if(!product) return <div style={{padding:40, textAlign:'center'}}>Loading product details...</div>;
  
  const allImages = getAllImages(product);
  const currentImg = allImages[activeImg] || allImages[0];

  return (
    <div style={{padding:20, maxWidth:1100, margin:'0 auto'}}>
      <button onClick={()=>nav(-1)} style={{padding:'8px 16px', borderRadius:8, border:'1px solid #ddd', background:'white', cursor:'pointer', marginBottom:20}}>← Back to Store</button>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:30, background:'white', padding:24, borderRadius:20, boxShadow:'0 10px 30px rgba(0,0,0,0.08)'}} className="responsive-grid">
        <div>
          <img src={resolveImg(currentImg)} style={{width:'100%', height:420, objectFit:'contain', borderRadius:14, background:'#f9f9f9', border:'1px solid #eee'}} alt={product.name}/>
          {/* THUMBNAILS - SWITCH IMAGE */}
          {allImages.length>1 && (
            <div style={{display:'flex', gap:10, marginTop:14, overflowX:'auto', paddingBottom:6}}>
              {allImages.map((img,i)=>(
                <img key={i} onClick={()=>setActiveImg(i)} src={resolveImg(img)} style={{width:72, height:72, objectFit:'cover', borderRadius:10, border: activeImg===i ? '3px solid black' : '2px solid #ddd', cursor:'pointer', flexShrink:0}} alt={`thumb ${i}`}/>
              ))}
            </div>
          )}
          {allImages.length>1 && <p style={{fontSize:12, color:'#888', marginTop:6}}>👆 Click thumbnail to switch - {allImages.length} images</p>}
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          <div style={{display:'flex', justifyContent:'space-between'}}>
            <span style={{background:'#eef6ff', color:'#0AA', padding:'6px 12px', borderRadius:20, width:'fit-content', fontWeight:'bold', fontSize:12}}>{sanitize(product.category)} • IN STOCK ✅</span>
            <button onClick={()=>toggleWishlist(product)} style={{border:'1px solid #ddd', background:'white', padding:'6px 12px', borderRadius:20, cursor:'pointer'}}>{isWish ? '❤️ Saved' : '🤍 Wishlist'}</button>
          </div>
          <h1 style={{fontSize:26, margin:0}}>{sanitize(product.name)}</h1>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <span style={{color:'gold', fontSize:18}}>★★★★★</span>
            <span><b>4.6</b> • {reviews.length} reviews • 120 sold</span>
          </div>
          <p style={{fontSize:28, fontWeight:'bold', margin:0}}>${Number(product.price) || 0}</p>
          <div style={{background:'#f5f7fb', padding:14, borderRadius:12}}>
            <h3 style={{margin:'0 0 6px 0', fontSize:16}}>Description</h3>
            <p style={{color:'#444', lineHeight:1.6, margin:0, fontSize:14}}>{sanitize(product.description) || 'High quality product from EsosaTech. Fast delivery in Hamburg. 7 days return.'}</p>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:12, marginTop:6}}>
            <span style={{fontWeight:'bold'}}>Qty:</span>
            <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{width:36, height:36, borderRadius:8, border:'1px solid #ddd', cursor:'pointer'}}>−</button>
            <span style={{width:30, textAlign:'center', fontWeight:'bold'}}>{qty}</span>
            <button onClick={()=>setQty(q=>Math.min(10,q+1))} style={{width:36, height:36, borderRadius:8, border:'1px solid #ddd', cursor:'pointer'}}>+</button>
          </div>
          <div style={{display:'flex', gap:10, marginTop:10}}>
            <button onClick={()=>{ for(let i=0;i<qty;i++) addToCart(product); nav('/cart'); }} style={{flex:2, padding:14, background:'black', color:'white', borderRadius:12, fontSize:15, fontWeight:'bold', border:'none', cursor:'pointer'}}>🛒 Buy Now - ${Number(product.price)*qty}</button>
            <button onClick={()=>{ for(let i=0;i<qty;i++) addToCart(product); }} style={{flex:1, padding:14, background:'white', color:'black', border:'2px solid black', borderRadius:12, fontSize:14, fontWeight:'bold', cursor:'pointer'}}>Add to Cart</button>
          </div>
          <div style={{marginTop:6, fontSize:12, color:'#666'}}>
            <p>✅ Free delivery in Hamburg • ✅ Pay with Paystack • ✅ 7 Days Return</p>
          </div>
        </div>
      </div>

      <div style={{marginTop:30, background:'white', padding:20, borderRadius:14}}>
        <h3>⭐ Customer Reviews ({reviews.length})</h3>
        {reviews.map((r,i)=><div key={i} style={{borderBottom:'1px solid #eee', padding:'10px 0'}}><b>{r.user}</b> - <span style={{color:'gold'}}>{'★'.repeat(r.rating)}</span><p style={{margin:'4px 0', fontSize:14, color:'#444'}}>{r.text}</p></div>)}
        <div style={{marginTop:16, display:'flex', gap:8}}>
          <input value={reviewText} onChange={e=>setReviewText(e.target.value)} placeholder="Write a review..." style={{flex:1, padding:12, borderRadius:8, border:'1px solid #ddd'}}/>
          <button onClick={()=>{ if(!reviewText) return; setReviews([{user:'You', rating:5, text:reviewText}, ...reviews]); setReviewText(''); alert('Review added ✅'); }} style={{padding:'12px 18px', background:'black', color:'white', borderRadius:8, border:'none', cursor:'pointer'}}>Post</button>
        </div>
      </div>

      {related.length>0 && (
        <div style={{marginTop:30}}>
          <h2>You may also like</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12}}>
            {related.map(r=>(
              <Link key={r._id} to={`/product/${r._id}`} style={{textDecoration:'none', color:'inherit', border:'1px solid #ddd', padding:10, borderRadius:12, background:'white'}}>
                <img src={resolveImg(getFirstImage(r))} style={{width:'100%', height:100, objectFit:'cover', borderRadius:8}} alt=""/>
                <p style={{fontWeight:'bold', margin:'6px 0 0 0', fontSize:13}}>{sanitize(r.name)}</p>
                <p style={{margin:0, fontSize:12}}>${r.price}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Wishlist(){
  const { wishlist, toggleWishlist } = useContext(WishlistContext);
  const { addToCart } = useContext(CartContext);
  return (
    <div style={{padding:20, maxWidth:900, margin:'0 auto'}}>
      <h2>❤️ My Wishlist ({wishlist.length})</h2>
      {wishlist.length===0 ? <p>No items saved. Go to Store and click 🤍</p> : 
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14}}>
          {wishlist.map(p=>(
            <div key={p._id} style={{border:'1px solid #ddd', padding:12, borderRadius:12, background:'white'}}>
              <Link to={`/product/${p._id}`} style={{textDecoration:'none', color:'black'}}><img src={resolveImg(getFirstImage(p))} style={{width:'100%', height:130, objectFit:'cover', borderRadius:8}} alt=""/><p style={{fontWeight:'bold'}}>{p.name}</p><p>${p.price}</p></Link>
              <div style={{display:'flex', gap:6}}><button onClick={()=>addToCart(p)} style={{flex:1, padding:8, background:'black', color:'white', borderRadius:6, border:'none', cursor:'pointer'}}>Add to Cart</button><button onClick={()=>toggleWishlist(p)} style={{padding:8, background:'#ffe0e0', borderRadius:6, border:'none', cursor:'pointer'}}>Remove</button></div>
            </div>
          ))}
        </div>
      }
    </div>
  )
}

function Login(){
  const [email,setEmail]=useState(''); const [pass,setPass]=useState('');
  const [loading,setLoading]=useState(false); const [attempts,setAttempts]=useState(0);
  const { setUser } = useContext(AuthContext); const nav=useNavigate();
  const submit=async(e)=>{
    e.preventDefault();
    if(attempts >= 5) return alert('Too many attempts');
    setLoading(true);
    try {
      const res=await fetch(`${API}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.toLowerCase().trim(),password:pass})});
      const data=await res.json();
      if(data.token){ localStorage.setItem('token',data.token); localStorage.setItem('user',JSON.stringify(data.user)); setUser(data.user); nav('/'); } 
      else { setAttempts(a=>a+1); alert(data.msg || 'Login failed'); }
    } catch { alert('Network error'); }
    setLoading(false);
  };
  const googleLogin = async () => {
    const googleEmail = prompt('Enter Google Email:');
    if(!googleEmail || !googleEmail.includes('@')) return;
    try {
      const res = await fetch(`${API}/api/auth/google`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:googleEmail.toLowerCase().trim(), firstName:'Google', lastName:'User'})});
      const data = await res.json();
      if(data.token){ localStorage.setItem('token',data.token); localStorage.setItem('user',JSON.stringify(data.user)); setUser(data.user); nav('/'); }
    } catch { alert('Google login failed'); }
  };
  return (
    <div style={{minHeight:'80vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'#f5f7fb'}}>
      <form onSubmit={submit} style={{width:'100%', maxWidth:480, background:'white', padding:40, borderRadius:20, boxShadow:'0 10px 30px rgba(0,0,0,0.1)', display:'flex', flexDirection:'column', gap:16}}>
        <h2 style={{fontSize:32, textAlign:'center', margin:0}}>Welcome back 👋</h2>
        <p style={{textAlign:'center', color:'#666', marginTop:-10}}>Login to EsosaTech</p>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required type="email" style={{padding:16, borderRadius:12, border:'1px solid #ddd', fontSize:16}}/>
        <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required style={{padding:16, borderRadius:12, border:'1px solid #ddd', fontSize:16}}/>
        <button disabled={loading} style={{padding:16, background:'black', color:'white', borderRadius:12, fontSize:16, fontWeight:'bold', cursor:'pointer', border:'none'}}>{loading?'Loading...':'Login →'}</button>
        <button type="button" onClick={googleLogin} style={{width:'100%', background:'white', color:'#222', border:'1px solid #ddd', padding:14, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', gap:12, fontWeight:600, cursor:'pointer'}}>Continue with Google</button>
        <p style={{textAlign:'center', fontSize:14}}>No account? <Link to="/register" style={{color:'#0AA', fontWeight:'bold'}}>Register</Link></p>
      </form>
    </div>
  );
}

function Register(){
  const [form,setForm]=useState({firstName:'',lastName:'',gender:'Male',country:'Nigeria',phone:'',email:'',password:''});
  const [error,setError]=useState(''); const [loading,setLoading]=useState(false); const nav=useNavigate();
  const { setUser } = useContext(AuthContext);
  const strength = checkPasswordStrength(form.password);
  const isStrong = form.password ? Object.values(strength).every(v=>v===true) : false;
  const handle = (k,v) => setForm({...form,[k]:v.slice(0,100)});
  const submit=async(e)=>{
    e.preventDefault();
    if(form.password && !isStrong){ setError('Password must be 8+ chars, Uppercase, lowercase, number, special !@#$%'); return; }
    setLoading(true);
    try {
      const res=await fetch(`${API}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form, email:form.email.toLowerCase().trim()})});
      const data=await res.json();
      if(data.token){ alert('Registered! ✅'); nav('/login'); } else { setError(data.msg || 'Failed'); }
    } catch { setError('Network error'); }
    setLoading(false);
  };
  const googleLogin = async () => {
    const googleEmail = prompt('Enter Google Email:');
    if(!googleEmail || !googleEmail.includes('@')) return;
    try {
      const res = await fetch(`${API}/api/auth/google`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:googleEmail.toLowerCase().trim(), firstName:'Google', lastName:'User'})});
      const data = await res.json();
      if(data.token){ localStorage.setItem('token',data.token); localStorage.setItem('user',JSON.stringify(data.user)); setUser(data.user); nav('/'); }
    } catch { alert('Google login failed'); }
  };
  return (
    <div style={{minHeight:'90vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'#f5f7fb'}}>
      <form onSubmit={submit} style={{width:'100%', maxWidth:520, background:'white', padding:36, borderRadius:20, boxShadow:'0 10px 30px rgba(0,0,0,0.1)', display:'flex', flexDirection:'column', gap:12}}>
        <h2 style={{fontSize:30, textAlign:'center', margin:0}}>Create Account</h2>
        <p style={{textAlign:'center', color:'#666', marginTop:-8, marginBottom:8}}>Join EsosaTech today</p>
        <div style={{display:'flex', gap:10}}><input value={form.firstName} onChange={e=>handle('firstName',e.target.value)} placeholder="First Name" required style={{flex:1, padding:14, borderRadius:10, border:'1px solid #ddd'}}/><input value={form.lastName} onChange={e=>handle('lastName',e.target.value)} placeholder="Last Name" required style={{flex:1, padding:14, borderRadius:10, border:'1px solid #ddd'}}/></div>
        <div style={{display:'flex', gap:10}}><select value={form.gender} onChange={e=>handle('gender',e.target.value)} style={{flex:1, padding:14, borderRadius:10, border:'1px solid #ddd'}}><option>Male</option><option>Female</option><option>Other</option></select><input value={form.country} onChange={e=>handle('country',e.target.value)} placeholder="Country" required style={{flex:1, padding:14, borderRadius:10, border:'1px solid #ddd'}}/></div>
        <input value={form.phone} onChange={e=>handle('phone',e.target.value)} placeholder="Phone" required style={{padding:14, borderRadius:10, border:'1px solid #ddd'}}/>
        <input value={form.email} onChange={e=>handle('email',e.target.value)} placeholder="Email" required type="email" style={{padding:14, borderRadius:10, border:'1px solid #ddd'}}/>
        <input type="password" value={form.password} onChange={e=>handle('password',e.target.value)} placeholder="Password" required style={{padding:14, borderRadius:10, border:'1px solid #ddd'}}/>
        {form.password && (<div style={{fontSize:12, background:'#f9f9f9', padding:10, borderRadius:8}}><div style={{color: strength.length ? 'green' : 'red'}}>{strength.length ? '✅' : '❌'} 8+ chars</div><div style={{color: strength.upper ? 'green' : 'red'}}>{strength.upper ? '✅' : '❌'} Uppercase</div><div style={{color: strength.lower ? 'green' : 'red'}}>{strength.lower ? '✅' : '❌'} lowercase</div><div style={{color: strength.number ? 'green' : 'red'}}>{strength.number ? '✅' : '❌'} Number</div><div style={{color: strength.special ? 'green' : 'red'}}>{strength.special ? '✅' : '❌'} Special !@#$%</div></div>)}
        {error && <p style={{color:'red', fontSize:13, textAlign:'center', background:'#ffe0e0', padding:8, borderRadius:6}}>{error}</p>}
        <button type="submit" disabled={loading} style={{background:'black', color:'white', padding:16, borderRadius:12, fontWeight:'bold', fontSize:16, border:'none', cursor:'pointer'}}>{loading ? 'Creating Account...' : 'Create Account'}</button>
        <button type="button" onClick={googleLogin} style={{width:'100%', background:'white', color:'#444', border:'1px solid #ddd', padding:14, borderRadius:12, fontWeight:600, cursor:'pointer'}}>Continue with Google</button>
      </form>
    </div>
  )
}

function Cart(){
  const { cart, remove, clearCart, updateQty } = useContext(CartContext); 
  const { user } = useContext(AuthContext); 
  const [address,setAddress]=useState(''); const [phone,setPhone]=useState(''); const [fullName,setFullName]=useState('');
  const nav=useNavigate();
  const grouped = Object.values(cart.reduce((acc,item)=>{
    if(!acc[item._id]) acc[item._id] = {...item, qty:0};
    acc[item._id].qty +=1;
    return acc;
  },{}));
  const total = grouped.reduce((s,i)=>s+ (Number(i.price)*i.qty),0);

  useEffect(()=>{
    if(!document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]')){
      const s=document.createElement('script'); s.src='https://js.paystack.co/v1/inline.js'; document.body.appendChild(s);
    }
  },[]);
  
  const payWithPaystack = () => {
    if(total <=0) return alert('Cart empty');
    if(!fullName || !address || !phone) return alert('Please fill Full Name, Address, Phone');
    if(!user?.email) return alert('Please login again');
    if(!PAYSTACK_PUBLIC_KEY) return alert('Missing VITE_PAYSTACK_KEY');
    if(!window.PaystackPop) return alert('Paystack loading... wait 2 sec');
    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY, email: user.email, amount: total * 100, currency: 'NGN', ref: 'ESOSA_'+Date.now(),
      callback: function(response){
        fetch(`${API}/api/pay/verify`,{
          method:'POST', headers:{'Content-Type':'application/json','x-auth-token':localStorage.getItem('token')},
          body:JSON.stringify({reference: response.reference, items: grouped, total, email: user.email, address, phone, fullName})
        }).then(r=>r.json()).then(d=>{ alert('Payment Success! ✅ Ref: '+response.reference); clearCart(); nav('/myorders'); })
        .catch(()=>{ alert('Payment done: '+response.reference); clearCart(); nav('/myorders'); });
      },
      onClose: function(){}
    });
    handler.openIframe();
  };

  return (
    <div style={{padding:20, maxWidth:700, margin:'0 auto'}}>
      <h2>Cart ({grouped.length} types, {cart.length} items) - ${total}</h2>
      {grouped.map((c)=><div key={c._id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #eee', padding:12, background:'white', marginBottom:6, borderRadius:8}}>
        <div style={{display:'flex', gap:10, alignItems:'center'}}><img src={resolveImg(getFirstImage(c))} style={{width:50, height:50, objectFit:'cover', borderRadius:6}} alt=""/><div><b>{sanitize(c.name)}</b><div style={{fontSize:12}}>${c.price} x {c.qty} = <b>${c.price*c.qty}</b></div></div></div>
        <div style={{display:'flex', gap:6, alignItems:'center'}}>
          <button onClick={()=>updateQty(c._id, -1)} style={{width:28, height:28, borderRadius:6, border:'1px solid #ddd', cursor:'pointer'}}>−</button>
          <span>{c.qty}</span>
          <button onClick={()=>updateQty(c._id, 1)} style={{width:28, height:28, borderRadius:6, border:'1px solid #ddd', cursor:'pointer'}}>+</button>
          <button onClick={()=>remove(c._id)} style={{background:'#ffe0e0', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer'}}>x</button>
        </div>
      </div>)}
      
      {grouped.length>0 && (
        <div style={{background:'white', padding:16, borderRadius:12, marginTop:20}}>
          <h3>🚚 Delivery Details (Required)</h3>
          <input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Full Name" style={{width:'100%', padding:12, borderRadius:8, border:'1px solid #ddd', marginBottom:8, boxSizing:'border-box'}}/>
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone Number e.g. +49..." style={{width:'100%', padding:12, borderRadius:8, border:'1px solid #ddd', marginBottom:8, boxSizing:'border-box'}}/>
          <textarea value={address} onChange={e=>setAddress(e.target.value)} placeholder="Full Delivery Address - Street, City, Hamburg..." style={{width:'100%', padding:12, borderRadius:8, border:'1px solid #ddd', minHeight:60, boxSizing:'border-box'}}></textarea>
          <button onClick={payWithPaystack} style={{marginTop:16, padding:16, background:'#0AA', color:'white', width:'100%', borderRadius:12, fontSize:18, fontWeight:'bold', cursor:'pointer', border:'none'}}>💳 Pay with Paystack - ${total}</button>
        </div>
      )}
      {grouped.length===0 && <p>Cart empty - Go to Store</p>}
    </div>
  )
}

function MyOrders(){
  const [orders,setOrders]=useState([]);
  const nav=useNavigate();
  useEffect(()=>{ fetch(`${API}/api/orders/my`,{headers:{'x-auth-token':localStorage.getItem('token')}}).then(r=>r.json()).then(d=> Array.isArray(d)? setOrders(d): setOrders([])).catch(()=> setOrders([])); },[]);
  return <div style={{padding:20, maxWidth:700, margin:'0 auto'}}><h2>My Orders</h2>{orders.map(o=><div key={o._id} onClick={()=>nav(`/order/${o._id}`)} style={{border:'1px solid #ddd', padding:16, marginBottom:10, borderRadius:12, background:'white', cursor:'pointer'}}><div style={{display:'flex', justifyContent:'space-between'}}><b>${o.total}</b><span style={{padding:'4px 8px', borderRadius:6, background: o.status==='Paid'?'#e0ffe0': o.status==='Shipped'?'#fff3cd':'#d4edda', fontSize:12}}>{o.status}</span></div><div style={{fontSize:12, color:'#666'}}>{o.items?.length} items • {new Date(o.createdAt).toLocaleDateString()}</div><small>Ref: {sanitize(o.paystackRef)} • Click 👁️</small></div>)}{orders.length===0 && <p>No orders yet</p>}</div>
}

function OrderDetails(){
  const { id } = useParams();
  const [order,setOrder]=useState(null);
  useEffect(()=>{ fetch(`${API}/api/orders/${id}`,{headers:{'x-auth-token':localStorage.getItem('token')}}).then(r=>r.json()).then(d=>setOrder(d)).catch(()=>setOrder(null)); },[id]);
  if(!order) return <div style={{padding:20}}>Loading order...</div>;
  return (
    <div style={{padding:20, maxWidth:600, margin:'0 auto'}}>
      <h2>Order Details</h2>
      <div style={{border:'2px solid #0AA', padding:20, borderRadius:14, background:'white'}}>
        <p><b>Order ID:</b> {order._id}</p>
        <p><b>Ref:</b> {sanitize(order.paystackRef)}</p>
        <p><b>Status:</b> <span style={{background: order.status==='Paid' ? '#e0ffe0' : order.status==='Shipped' ? '#fff3cd' : '#d4edda', padding:'4px 10px', borderRadius:6}}>{order.status}</span></p>
        <p><b>Total:</b> ${order.total}</p>
        <p><b>Customer:</b> {sanitize(order.fullName)} - {sanitize(order.phone)}</p>
        <p><b>Address:</b> {sanitize(order.address)}</p>
        <p><b>Email:</b> {order.email || order.userEmail}</p>
        <h3>Items:</h3>
        {(order.items||[]).map((it,i)=><div key={i} style={{display:'flex', justifyContent:'space-between', padding:8, borderBottom:'1px solid #eee'}}><span>{sanitize(it.name)} {it.qty ? `x${it.qty}` : ''}</span><b>${Number(it.price)*(it.qty||1)}</b></div>)}
      </div>
      <Link to="/myorders" style={{display:'inline-block', marginTop:15, color:'#0AA', fontWeight:'bold'}}>← Back to My Orders</Link>
    </div>
  )
}

function Admin(){
  const [orders,setOrders]=useState([]); 
  const [products,setProducts]=useState([]);
  const [name,setName]=useState(''); const [price,setPrice]=useState(''); const [images,setImages]=useState([]); const [category,setCategory]=useState('phones'); const [desc,setDesc]=useState(''); const [uploading,setUploading]=useState(false);
  const fetchAll = ()=>{
    fetch(`${API}/api/orders/all`,{headers:{'x-auth-token':localStorage.getItem('token')}}).then(r=>r.json()).then(d=>Array.isArray(d)?setOrders(d):setOrders([])).catch(()=>setOrders([]));
    fetch(`${API}/api/products`).then(r=>r.json()).then(d=>Array.isArray(d)?setProducts(d):setProducts([])).catch(()=>setProducts([]));
  };
  useEffect(()=>{ fetchAll(); },[]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files); if(!files.length) return;
    if(files.length + images.length > 5) return alert('Max 5 images total');
    for(let f of files){ if(f.size > 2*1024*1024) return alert(`${f.name} too big - Max 2MB`); }
    setUploading(true);
    try{
      // Try multiple endpoint first, fallback to single uploads
      let uploaded = [];
      const fd = new FormData();
      files.forEach(f=>fd.append('images', f));
      let res = await fetch(`${API}/api/upload-multiple`,{method:'POST',headers:{'x-auth-token':localStorage.getItem('token')},body:fd});
      if(res.ok){
        const data = await res.json();
        if(data.paths) uploaded = data.paths.map(p=> p.startsWith('http') ? p : `${API}${p}`);
        else if(data.path) uploaded = [`${API}${data.path}`];
      } else {
        // fallback: upload one by one to /api/upload
        for(let f of files){
          const fd2 = new FormData(); fd2.append('image', f);
          const r2 = await fetch(`${API}/api/upload`,{method:'POST',headers:{'x-auth-token':localStorage.getItem('token')},body:fd2});
          const d2 = await r2.json();
          if(d2.path) uploaded.push(`${API}${d2.path}`);
        }
      }
      if(uploaded.length){
        setImages(prev=>[...prev, ...uploaded].slice(0,5));
        alert(`${uploaded.length} images uploaded ✅`);
      } else alert('Upload failed - check server.js has /api/upload-multiple route');
    }catch{ alert('Upload error - make sure server.js updated'); }
    setUploading(false);
  };

  const addProduct=async(e)=>{
    e.preventDefault(); 
    if(images.length===0) return alert('Upload at least 1 image');
    try {
      const res = await fetch(`${API}/api/products`,{method:'POST',headers:{'Content-Type':'application/json','x-auth-token':localStorage.getItem('token')},body:JSON.stringify({name: sanitize(name), price:Number(price), images, image: images[0], category, description: sanitize(desc)})});
      const data = await res.json(); 
      if(data._id){ alert('Product Added ✅ with '+images.length+' images'); setName('');setPrice('');setImages([]);setDesc(''); fetchAll(); } else alert(data.msg || 'Failed');
    } catch { alert('Add failed'); }
  };
  const deleteProduct = async (id, productName)=>{
    if(!confirm(`Delete ${productName}?`)) return;
    const res = await fetch(`${API}/api/products/${id}`,{method:'DELETE', headers:{'x-auth-token':localStorage.getItem('token')}});
    if(res.ok){ alert('Deleted ✅'); setProducts(products.filter(p=>p._id!==id)); }
  };
  const deleteOrder = async (id)=>{
    if(!confirm('Delete this order?')) return;
    const res = await fetch(`${API}/api/orders/${id}`,{method:'DELETE', headers:{'x-auth-token':localStorage.getItem('token')}});
    if(res.ok){ alert('Order deleted ✅'); setOrders(orders.filter(o=>o._id!==id)); }
  };
  const updateStatus = async (id, status)=>{
    const res = await fetch(`${API}/api/orders/${id}/status`,{method:'PATCH', headers:{'Content-Type':'application/json','x-auth-token':localStorage.getItem('token')}, body:JSON.stringify({status})});
    if(res.ok){ alert(`Order ${status} ✅`); fetchAll(); }
  };
  const totalSales = orders.reduce((s,o)=>s+ (Number(o.total) || 0),0);
  return (
    <div style={{padding:20}}>
      <h2 style={{textAlign:'center'}}>Admin - Orders ({orders.length}) - Sales ${totalSales} - Products ({products.length})</h2>
      <form onSubmit={addProduct} style={{border:'2px solid #222', padding:24, maxWidth:700, margin:'0 auto 30px auto', borderRadius:18, background:'white'}}>
        <h3 style={{textAlign:'center'}}>Add Product - Multi Image (Max 5)</h3>
        <div style={{display:'flex', gap:10, marginBottom:10}}><input value={name} onChange={e=>setName(e.target.value)} placeholder="Product Name" required style={{flex:2, padding:12, borderRadius:8, border:'1px solid #ccc'}}/><select value={category} onChange={e=>setCategory(e.target.value)} style={{flex:1, padding:12, borderRadius:8}}><option>phones</option><option>laptops</option><option>shirts</option><option>watches</option><option>headphones</option><option>gaming</option><option>accessories</option></select></div>
        <div style={{display:'flex', gap:10, marginBottom:10}}><input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description" required style={{flex:2, padding:12, borderRadius:8, border:'1px solid #ccc'}}/><input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Price $" type="number" required style={{flex:1, padding:12, borderRadius:8, border:'1px solid #ccc'}}/></div>
        
        <div style={{background:'#eef6ff', padding:14, borderRadius:10, border:'2px dashed #0AA', textAlign:'center', marginBottom:10}}>
          <label style={{fontWeight:'bold', display:'block', marginBottom:8}}>📁 Upload 1-5 Images - Select multiple at once</label>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload}/>
          {uploading && <p style={{color:'#0AA', fontWeight:'bold'}}>Uploading... please wait</p>}
        </div>
        
        {images.length>0 && (
          <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:12, background:'#f9f9f9', padding:10, borderRadius:8}}>
            {images.map((img,i)=>(
              <div key={i} style={{position:'relative'}}>
                <img src={img} alt="preview" style={{width:80, height:80, objectFit:'cover', borderRadius:8, border:'2px solid #0AA'}}/>
                <button type="button" onClick={()=>setImages(images.filter((_,idx)=>idx!==i))} style={{position:'absolute', top:-6, right:-6, background:'red', color:'white', border:'none', borderRadius:20, width:22, height:22, cursor:'pointer', fontWeight:'bold'}}>x</button>
                <div style={{fontSize:10, textAlign:'center'}}>{i===0 ? 'MAIN' : `IMG ${i+1}`}</div>
              </div>
            ))}
          </div>
        )}

        <button type="submit" style={{width:'100%', padding:14, background:'black', color:'white', borderRadius:10, fontWeight:'bold', border:'none', cursor:'pointer'}}>➕ Add Product with {images.length} Images</button>
      </form>

      <h3>🛒 Products - Showing image count</h3>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:30}}>
        {products.map(p=>(
          <div key={p._id} style={{border:'1px solid #ddd', padding:10, borderRadius:10, background:'white'}}>
            <img src={resolveImg(getFirstImage(p))} style={{width:'100%', height:120, objectFit:'cover', borderRadius:8}} alt=""/>
            <p style={{margin:'6px 0 2px 0', fontWeight:'bold', fontSize:13}}>{sanitize(p.name)} {getAllImages(p).length>1 && <span style={{background:'black', color:'white', fontSize:10, padding:'2px 5px', borderRadius:4}}>{getAllImages(p).length} imgs</span>}</p>
            <p style={{margin:0, fontSize:12}}>${p.price} - {p.category}</p>
            <button onClick={()=>deleteProduct(p._id, p.name)} style={{width:'100%', marginTop:6, background:'#FF4444', color:'white', padding:6, borderRadius:6, border:'none', cursor:'pointer'}}>🗑️ Delete</button>
          </div>
        ))}
      </div>

      <h3>📦 All Orders - Update Status</h3>
      <div style={{display:'grid', gap:8}}>
        {orders.map(o=>(
          <div key={o._id} style={{border:'1px solid #ddd', padding:12, borderRadius:8, background:'white'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8}}>
              <div><Link to={`/order/${o._id}`} style={{fontWeight:'bold', color:'#0AA'}}>{o.total}$ - {o.status} - {sanitize(o.email||o.userEmail)}</Link><div style={{fontSize:11}}>{sanitize(o.fullName)} • {sanitize(o.phone)}</div></div>
              <div style={{display:'flex', gap:6}}>
                <button onClick={()=>updateStatus(o._id,'Shipped')} style={{background:'#fff3cd', border:'1px solid #ddd', padding:'6px 10px', borderRadius:6, cursor:'pointer'}}>🚚 Shipped</button>
                <button onClick={()=>updateStatus(o._id,'Delivered')} style={{background:'#d4edda', border:'1px solid #ddd', padding:'6px 10px', borderRadius:6, cursor:'pointer'}}>✅ Delivered</button>
                <button onClick={()=>deleteOrder(o._id)} style={{background:'#FF4444', color:'white', padding:'6px 10px', borderRadius:6, border:'none'}}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App(){
  const [user,setUser]=useState(()=>{ try{ const u=JSON.parse(localStorage.getItem('user')); return u && u.email ? u : null }catch{return null} });
  const [cart,setCart]=useState([]);
  const [wishlist,setWishlist]=useState(()=>{ try{return JSON.parse(localStorage.getItem('wishlist')||'[]')}catch{return []} });
  
  const addToCart=(p)=>{ setCart([...cart,p]); };
  const remove=(id)=>{ setCart(cart.filter(c=>c._id!==id)); };
  const updateQty=(id, delta)=>{
    if(delta===1){ 
      const item = cart.find(c=>c._id===id) || { _id:id };
      // find original product data to copy price etc - use cart item
      const real = cart.find(c=>c._id===id);
      setCart([...cart, real || item]); 
      return; 
    }
    let found=false;
    let newCart=[];
    for(let item of cart){ if(!found && item._id===id){ found=true; continue; } newCart.push(item); }
    setCart(newCart);
  };
  const clearCart=()=>setCart([]);
  const toggleWishlist=(p)=>{
    const exists = wishlist.find(w=>w._id===p._id);
    let newList = exists ? wishlist.filter(w=>w._id!==p._id) : [...wishlist, p];
    setWishlist(newList);
    localStorage.setItem('wishlist', JSON.stringify(newList));
  };
  useEffect(()=>{ localStorage.setItem('wishlist', JSON.stringify(wishlist)); },[wishlist]);
  
  const isAdmin = user?.isAdmin === true;
  useEffect(()=>{ const script = document.createElement('script'); script.src = 'https://js.paystack.co/v1/inline.js'; document.body.appendChild(script); },[]);
  
  return (
    <AuthContext.Provider value={{user,setUser}}><CartContext.Provider value={{cart,addToCart,remove,clearCart,updateQty}}><WishlistContext.Provider value={{wishlist,toggleWishlist}}>
      <BrowserRouter>
        <nav style={{display:'flex', gap:12, padding:14, background:'black', color:'white', alignItems:'center', flexWrap:'wrap', position:'sticky', top:0, zIndex:10}}>
          <Link to="/" style={{color:'white', fontWeight:'bold', fontSize:18}}>EsosaTech</Link>
          <Link to="/" style={{color:'white'}}>Store</Link>
          <Link to="/cart" style={{color:'white'}}>Cart ({cart.length})</Link>
          <Link to="/wishlist" style={{color:'#ffb3b3'}}>❤️ ({wishlist.length})</Link>
          {user && <Link to="/myorders" style={{color:'white'}}>My Orders</Link>}
          {isAdmin && <Link to="/admin" style={{background:'gold', color:'black', padding:'6px 12px', borderRadius:8, fontWeight:'bold'}}>Admin 👑</Link>}
          {!user ? <><Link to="/login" style={{color:'white'}}>Login</Link><Link to="/register" style={{color:'white'}}>Register</Link></> : <><span style={{opacity:0.8, fontSize:12}}>{user.email}</span><button onClick={()=>{localStorage.clear();setUser(null); window.location='/';}} style={{padding:'6px 10px', borderRadius:6, border:'none', cursor:'pointer'}}>Logout</button></>}
        </nav>
        <style>{`@media(max-width:768px){ .responsive-grid{grid-template-columns:1fr !important;} }`}</style>
        <Routes>
          <Route path="/" element={<Store/>}/>
          <Route path="/product/:id" element={<ProductDetails/>}/>
          <Route path="/wishlist" element={<Wishlist/>}/>
          <Route path="/login" element={<Login/>}/>
          <Route path="/register" element={<Register/>}/>
          <Route path="/cart" element={<ProtectedRoute><Cart/></ProtectedRoute>}/>
          <Route path="/myorders" element={<ProtectedRoute><MyOrders/></ProtectedRoute>}/>
          <Route path="/order/:id" element={<ProtectedRoute><OrderDetails/></ProtectedRoute>}/>
          <Route path="/admin" element={<ProtectedRoute adminOnly><Admin/></ProtectedRoute>}/>
        </Routes>
      </BrowserRouter>
    </WishlistContext.Provider></CartContext.Provider></AuthContext.Provider>
  );
}