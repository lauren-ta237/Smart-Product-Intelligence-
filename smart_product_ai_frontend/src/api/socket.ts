import { BACKEND_ORIGIN } from "./config";

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
const websocketOrigin = BACKEND_ORIGIN
    ? BACKEND_ORIGIN.replace(/^http/, "ws")
    : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
const socket =
new WebSocket(
`${websocketOrigin}/api/v1/ws/analysis/${analysisId}`
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