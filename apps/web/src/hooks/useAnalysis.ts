import {useQuery}
from "@tanstack/react-query";
import {
getAnalysis,
getDetectedProducts
}
from "../api/analysis";

export function useAnalysis(
id:string
){

const analysis=useQuery({
queryKey:["analysis",id],
queryFn:()=>getAnalysis(id),
refetchInterval:3000
});

const products=useQuery({
queryKey:["products",id],
queryFn:()=>getDetectedProducts(id),
refetchInterval:3000
});

return {
 analysis,
 products
};

}