import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif'}}>
      <div>
        <h1 style={{fontSize:32,marginBottom:8}}>404 - ไม่พบหน้านี้</h1>
        <p>
          กลับไปหน้าแรกได้ที่{' '}
          <Link href="/" style={{color:'#2563eb'}}>หน้าแรก</Link>
        </p>
      </div>
    </div>
  );
}
