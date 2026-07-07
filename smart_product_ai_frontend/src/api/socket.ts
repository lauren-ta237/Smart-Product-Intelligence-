/*
    Real time AI progress.
    Instead of refreshing:
    Processing...
    20%
    80%
    Completed
    arrives instantly.
*/
export function connectAnalysisSocket(
analysisId:string,
callback:(data:any)=>void
){
const socket =
new WebSocket(
`ws://localhost:8000/api/v1/ws/analysis/${analysisId}`
);
socket.onmessage =
(event)=>{
    const data =
    JSON.parse(
        event.data
    );
    callback(data);
};

return socket;

}