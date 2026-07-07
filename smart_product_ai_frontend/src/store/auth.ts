import {create} from "zustand";


interface AuthState {
    token:string | null;
    login:
    (token:string)=>void;
    logout:
    ()=>void;
}

/*
 Global authentication state.
 Keeps vendor logged in
 across pages.
*/
export const useAuth =
create<AuthState>((set)=>({
    token:
    localStorage.getItem(
        "access_token"
    ),

    login:(token)=>{
        localStorage.setItem(
            "access_token",
            token
        );
        set({
            token
        });
    },
    logout:()=>{
        localStorage.removeItem(
            "access_token"
        );
        set({
            token:null
        });
    }
}));