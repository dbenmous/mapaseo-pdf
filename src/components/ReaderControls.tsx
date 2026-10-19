import { Bookmark, ChevronsDown, ChevronsUp, ChevronDown, ChevronUp, Files, Highlighter, List, Maximize, MessageSquare, Minus, MousePointer2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Pencil, Plus, RotateCw, Settings, Signature, SlidersHorizontal, Sparkles, SquareDashed, StickyNote, Type, Undo2, Redo2, CircleHelp, MoveHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Tool } from '../types';
import { shortcutLabel } from '../lib/platform';
export type Zoom = number | 'fit' | 'width';
type LeftMode = 'pages' | 'outline' | 'search';
type RightMode = 'assistant' | 'tools' | 'comments';

function Control({ icon:Icon, label, active=false, disabled=false, onClick, expanded }: { icon:LucideIcon; label:string; active?:boolean; disabled?:boolean; onClick:()=>void; expanded?:boolean }) {
  label = shortcutLabel(label);
  return <button className={`icon-button ${active?'active':''}`} type="button" title={label} aria-label={label} aria-expanded={expanded} disabled={disabled} onClick={onClick}><Icon size={18}/></button>;
}

export function QuickTools({ leftOpen, onToggleNavigation, tool, onTool, color, onColor, onUndo, onRedo, canUndo, canRedo }: { leftOpen:boolean; onToggleNavigation:()=>void; tool:Tool; onTool:(tool:Tool)=>void; color:string; onColor:()=>void; onUndo:()=>void; onRedo:()=>void; canUndo:boolean; canRedo:boolean }) {
  return <aside className="quick-tools" aria-label="Annotation tools">
    <Control icon={leftOpen?PanelLeftClose:PanelLeftOpen} label={leftOpen?'Hide navigation':'Show navigation'} expanded={leftOpen} onClick={onToggleNavigation}/>
    <span className="quick-divider"/>
    <Control icon={MousePointer2} label="Select text (Escape)" active={tool==='select'} onClick={()=>onTool('select')}/>
    <Control icon={Highlighter} label="Highlight area" active={tool==='highlight'} onClick={()=>onTool('highlight')}/>
    <Control icon={Pencil} label="Draw" active={tool==='draw'} onClick={()=>onTool('draw')}/>
    <Control icon={Type} label="Add text" active={tool==='text'} onClick={()=>onTool('text')}/>
    <Control icon={StickyNote} label="Add comment" active={tool==='note'} onClick={()=>onTool('note')}/>
    <Control icon={Signature} label="Add signature" active={tool==='signature'} onClick={()=>onTool('signature')}/>
    <Control icon={SquareDashed} label="Draw rectangle" active={tool==='rectangle'} onClick={()=>onTool('rectangle')}/>
    <button className="annotation-color-control" title="Change annotation color" aria-label="Change annotation color" onClick={onColor}><span style={{background:color}}/></button>
    <span className="quick-divider"/>
    <Control icon={Undo2} label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}/>
    <Control icon={Redo2} label="Redo (Ctrl+Y)" disabled={!canRedo} onClick={onRedo}/>
  </aside>;
}

export function ViewRail({ rightOpen, rightMode, onTogglePanel, onRightMode, leftOpen, leftMode, onLeftMode, page, pages, onPage, zoom, onZoom, actualZoom, onRotate, bookmarked, onBookmark, onSettings, onHelp }: { rightOpen:boolean; rightMode:RightMode; onTogglePanel:()=>void; onRightMode:(mode:RightMode)=>void; leftOpen:boolean; leftMode:LeftMode; onLeftMode:(mode:LeftMode)=>void; page:number; pages:number; onPage:(page:number)=>void; zoom:Zoom; onZoom:(zoom:Zoom)=>void; actualZoom:number; onRotate:()=>void; bookmarked:boolean; onBookmark:()=>void; onSettings:()=>void; onHelp:()=>void }) {
  return <aside className="view-rail" aria-label="Document navigation and view controls">
    <div className="rail-actions">
      <Control icon={rightOpen?PanelRightClose:PanelRightOpen} label={rightOpen?'Hide tools panel':'Show tools panel'} expanded={rightOpen} onClick={onTogglePanel}/>
      <Control icon={Sparkles} label="Document assistant" active={rightOpen&&rightMode==='assistant'} onClick={()=>onRightMode('assistant')}/>
      <Control icon={SlidersHorizontal} label="Document tools" active={rightOpen&&rightMode==='tools'} onClick={()=>onRightMode('tools')}/>
      <Control icon={MessageSquare} label="Comments" active={rightOpen&&rightMode==='comments'} onClick={()=>onRightMode('comments')}/>
      <span className="quick-divider"/>
      <Control icon={Files} label="Pages" active={leftOpen&&leftMode==='pages'} onClick={()=>onLeftMode('pages')}/>
      <Control icon={List} label="Document outline" active={leftOpen&&leftMode==='outline'} onClick={()=>onLeftMode('outline')}/>
      <Control icon={Bookmark} label="Bookmark this page" active={bookmarked} onClick={onBookmark}/>
    </div>
    <div className="view-controls">
      <div className="rail-page-field"><input aria-label="Current page" type="number" min={1} max={pages||1} value={page} onChange={e=>onPage(Math.max(1,Math.min(pages||1,Number(e.target.value)||1)))}/><span>of {pages||'—'}</span></div>
      <div className="page-stepper"><Control icon={ChevronsUp} label="First page" disabled={page<=1} onClick={()=>onPage(1)}/><Control icon={ChevronUp} label="Previous page" disabled={page<=1} onClick={()=>onPage(page-1)}/><Control icon={ChevronDown} label="Next page" disabled={page>=(pages||1)} onClick={()=>onPage(page+1)}/><Control icon={ChevronsDown} label="Last page" disabled={page>=(pages||1)} onClick={()=>onPage(pages||1)}/></div>
      <span className="quick-divider"/>
      <Control icon={RotateCw} label="Rotate current page" disabled={!pages} onClick={onRotate}/>
      <Control icon={MoveHorizontal} label="Fit width" active={zoom==='width'} onClick={()=>onZoom('width')}/>
      <Control icon={Maximize} label="Fit page" active={zoom==='fit'} onClick={()=>onZoom('fit')}/>
      <select className="zoom-select" aria-label="Zoom" title="Zoom" value={zoom} onChange={e=>onZoom(e.target.value==='fit'?'fit':e.target.value==='width'?'width':Number(e.target.value))}>
        <option value="fit">Page</option><option value="width">Width</option>
        {[25,50,75,100,125,150,200,300].map(value=><option key={value} value={value}>{value}%</option>)}
        {typeof zoom==='number'&&![25,50,75,100,125,150,200,300].includes(zoom)&&<option value={zoom}>{zoom}%</option>}
      </select>
      <Control icon={Plus} label="Zoom in" onClick={()=>onZoom(Math.min(300,actualZoom+10))}/>
      <Control icon={Minus} label="Zoom out" onClick={()=>onZoom(Math.max(25,actualZoom-10))}/>
    </div>
    <div className="rail-settings"><Control icon={Settings} label="Settings" onClick={onSettings}/><Control icon={CircleHelp} label="About Mapaseo PDF" onClick={onHelp}/></div>
  </aside>;
}
