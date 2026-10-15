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
	<section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-slate-200 shadow-xl backdrop-blur-xl">
		<h2 className="text-lg font-bold text-white">AI Pipeline</h2>

		<ol className="mt-5 space-y-4">
			{steps.map((step, index) => (
				<li key={step} className="relative flex gap-3">
					{index < steps.length - 1 && (
						<span className="absolute left-4 top-8 h-[calc(100%+1rem)] w-px bg-white/10" />
					)}
					<span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-sm font-bold text-emerald-400">
						{index + 1}
					</span>
					<div className="min-w-0 pt-1">
						<p className="text-sm font-semibold text-slate-100">{step}</p>
						{index === steps.length - 1 && (
							<p className="mt-1 text-sm text-emerald-400">{status}</p>
						)}
					</div>
				</li>
			))}
		</ol>
	</section>
);
}