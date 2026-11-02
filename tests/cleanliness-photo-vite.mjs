import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[{
  name:'local-photo-audit-service',enforce:'pre',
  resolveId(id){if(id.endsWith('/services/v3Service.js'))return '\0photo-audit-service';},
  load(id){if(id==='\0photo-audit-service')return `
    let deletes=0,uploads=0,resolveDelete,resolveUpload;
    const update=()=>document.dispatchEvent(new Event('photo-audit-update'));
    export const bangkokDate=()=> '2026-11-02';
    export const saveDutySubmission=async()=>{};
    export const saveEvaluation=async()=>{};
    export const deleteEvaluation=async()=>{};
    export async function deleteSubmissionPhoto(){deletes++;update();await new Promise(r=>resolveDelete=r);return {cleanupWarning:false};}
    export async function uploadSubmissionPhoto(){uploads++;update();await new Promise(r=>resolveUpload=r);return {id:'uploaded'};}
    export const auditCounts=()=>({deletes,uploads});
    export const finishDelete=()=>resolveDelete?.();
    export const finishUpload=()=>resolveUpload?.();
  `;}
},react()],server:{host:'127.0.0.1',port:4187}});
