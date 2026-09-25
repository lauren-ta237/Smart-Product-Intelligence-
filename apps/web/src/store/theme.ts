import {create} from "zustand";

interface ThemeState{
dark:boolean;
toggle:()=>void;
}

/*
 Stores user theme preference.
 Later we connect it
 to Tailwind dark mode.
*/
export const useTheme =
create<ThemeState>(
(set)=>({

dark:false,

toggle:()=>set(
state=>({
dark:!state.dark
})
)

})
);