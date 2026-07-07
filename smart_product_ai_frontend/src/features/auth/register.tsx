import {useState} from "react";
import {useNavigate, Link} from "react-router-dom";

import {api} from "../../api/client";

export default function Register(){

const navigate=useNavigate();

const [form,setForm]=useState({
 company_name:"",
 email:"",
 password:"",
 country:"",
 city:"",
 language:"en"
});

const [loading,setLoading]=useState(false);

const [error,setError]=useState("");

function updateField(
 field:string,
 value:string
){

 setForm({
  ...form,
  [field]:value
 });

}

async function handleSubmit(
 e:React.FormEvent
){

 e.preventDefault();

 setLoading(true);

 setError("");

 try{

  /*
   Backend endpoint:

   POST /auth/register
  */

  await api.post(
   "/auth/register",
   form
  );

  navigate("/login");

 }catch{

  setError(
   "Registration failed"
  );

 }finally{

  setLoading(false);

 }

}

return (

<div className="
min-h-screen
flex
items-center
justify-center
bg-gray-100
">

<form
onSubmit={handleSubmit}
className="
bg-white
shadow-xl
rounded-xl
p-8
w-[450px]
space-y-4
"
>

<h1 className="
text-3xl
font-bold
">

Vendor Registration

</h1>

<p className="text-gray-500">
Create your vendor account
</p>


{error && (

<div className="
bg-red-100
text-red-600
p-3
rounded
">

{error}

</div>

)}


<input
className="border p-3 w-full rounded"
placeholder="Company Name"
value={form.company_name}
onChange={e=>
 updateField(
  "company_name",
  e.target.value
 )
}
/>

<input
className="border p-3 w-full rounded"
placeholder="Email"
type="email"
value={form.email}
onChange={e=>
 updateField(
  "email",
  e.target.value
 )
}
/>

<input
className="border p-3 w-full rounded"
placeholder="Password"
type="password"
value={form.password}
onChange={e=>
 updateField(
  "password",
  e.target.value
 )
}
/>

<input
className="border p-3 w-full rounded"
placeholder="Country"
value={form.country}
onChange={e=>
 updateField(
  "country",
  e.target.value
 )
}
/>

<input
className="border p-3 w-full rounded"
placeholder="City"
value={form.city}
onChange={e=>
 updateField(
  "city",
  e.target.value
 )
}
/>

<select
className="border p-3 w-full rounded"
value={form.language}
onChange={e=>
 updateField(
  "language",
  e.target.value
 )
}
>

<option value="en">
English
</option>

<option value="fr">
French
</option>

<option value="es">
Spanish
</option>

</select>

<button
disabled={loading}
className="
w-full
bg-black
text-white
p-3
rounded
"
>

{
 loading
 ?
 "Creating Account..."
 :
 "Register"
}

</button>

<div className="text-center">

<Link
to="/login"
className="text-blue-600"
>

Already have an account?

</Link>

</div>

</form>

</div>

);

}