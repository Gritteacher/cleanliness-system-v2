import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';

GlobalWorkerOptions.workerSrc=workerUrl;

export async function practicePdfToImages(blob, basename, onProgress=()=>{}) {
  const task=getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,useSystemFonts:false});
  let pdf;
  try{
    pdf=await task.promise;
    const zip=pdf.numPages>1?new JSZip():null;
    let single;
    for(let number=1;number<=pdf.numPages;number++){
      onProgress(number,pdf.numPages);
      const page=await pdf.getPage(number),viewport=page.getViewport({scale:2});
      const canvas=document.createElement('canvas');
      try{
        canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        const context=canvas.getContext('2d',{alpha:false});
        if(!context)throw new Error('หน่วยความจำไม่เพียงพอ กรุณาเลือกช่วงวันที่สั้นลง');
        await page.render({canvasContext:context,viewport,background:'white'}).promise;
        const png=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('สร้างภาพไม่สำเร็จ')),'image/png'));
        if(zip)zip.file(`${basename}-page-${String(number).padStart(3,'0')}.png`,await png.arrayBuffer());else single=png;
      }finally{page.cleanup();canvas.width=1;canvas.height=1;}
    }
    return zip?{blob:await zip.generateAsync({type:'blob',compression:'STORE'}),extension:'zip',pages:pdf.numPages}:{blob:single,extension:'png',pages:1};
  }finally{await task.destroy();}
}
