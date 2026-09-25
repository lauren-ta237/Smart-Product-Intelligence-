interface Props{
status:string;

}

/*
 Shows the AI pipeline state.
 Example:
 Uploading
 Processing
 Completed
*/

export default function ProcessingTimeline(
{
status
}:Props
){

const steps=[
"Image Uploaded",
"AI Detection",
"Product Extraction",
"Vendor Review"
];

return (

<div className="
bg-white
p-6
rounded-xl
shadow
">

<h2 className="font-bold text-xl">
AI Pipeline
</h2>

<div className="mt-5 space-y-4">

{
steps.map(
(step,index)=>(

<div
key={step}
className="flex gap-3"
>

<div className="
w-8
h-8
rounded-full
bg-black
text-white
flex
items-center
justify-center
">

{index+1}

</div>

<div>

<p className="font-semibold">
{step}
</p>

{
index === steps.length-1 &&
<p className="text-sm">
{status}
</p>
}

</div>

</div>

)
)
}
</div>
</div>
)
}