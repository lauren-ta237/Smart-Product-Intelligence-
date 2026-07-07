import {useQuery} from "@tanstack/react-query";
import {getDashboardStats}
from "../api/dashboard";

/*
 React Query handles:
 - loading
 - caching
 - refetching
*/

export function useDashboard(){
 return useQuery({
  queryKey:["dashboard"],
  queryFn:getDashboardStats
 });
}