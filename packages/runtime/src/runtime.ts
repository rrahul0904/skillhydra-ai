import { makeId, type AgentRun, type ModelUsage, type SkillBundle, type ToolRequest } from "@skillhydra/core";
import { evaluateToolPolicy } from "@skillhydra/policy";
import type { SandboxExecutor } from "@skillhydra/sandbox";
import type { AgentModel, ModelHistoryItem } from "./model.ts";

const ZERO_USAGE:ModelUsage={inputTokens:0,outputTokens:0,totalTokens:0,estimatedCostUsd:0};
function addUsage(total:ModelUsage,next?:ModelUsage){if(!next)return total;return{inputTokens:total.inputTokens+next.inputTokens,outputTokens:total.outputTokens+next.outputTokens,totalTokens:total.totalTokens+next.totalTokens,estimatedCostUsd:total.estimatedCostUsd+next.estimatedCostUsd}}

export class AgentRuntime{
  private readonly model:AgentModel;private readonly executor:SandboxExecutor;private readonly maxToolSteps:number;
  constructor(model:AgentModel,executor:SandboxExecutor,maxToolSteps=6){this.model=model;this.executor=executor;this.maxToolSteps=maxToolSteps}
  async runTurn(skill:SkillBundle,message:string):Promise<AgentRun>{
    try{return await this.executeTurn(skill,message)}finally{await this.executor.close?.()}
  }
  private async executeTurn(skill:SkillBundle,message:string):Promise<AgentRun>{
    const runId=makeId("run");const steps:AgentRun["steps"]=[];const history:ModelHistoryItem[]=[];let usage={...ZERO_USAGE};let modelName:string|undefined;let lastRequest:ToolRequest|undefined;let lastPolicy:AgentRun["policyDecision"];
    for(let iteration=0;iteration<=this.maxToolSteps;iteration+=1){
      const decision=await this.model.decide(message,{skill,history});usage=addUsage(usage,decision.usage);modelName=decision.model??modelName;
      steps.push({id:makeId("step"),kind:"model",title:iteration===0?"Specialist planned next action":"Specialist evaluated tool result",status:"completed",detail:decision.response});
      if(!decision.tool)return{id:runId,skill:skill.manifest.name,message,status:"completed",response:decision.response,steps,toolRequest:lastRequest,policyDecision:lastPolicy,model:modelName,usage};
      if(iteration===this.maxToolSteps)return{id:runId,skill:skill.manifest.name,message,status:"failed",response:"Tool-step limit reached before the task completed.",steps,toolRequest:lastRequest,policyDecision:lastPolicy,model:modelName,usage};
      const request:ToolRequest={id:makeId("tool"),tool:decision.tool.name,input:decision.tool.input};const policy=evaluateToolPolicy(skill.manifest,request.tool);lastRequest=request;lastPolicy=policy;
      steps.push({id:makeId("step"),kind:"policy",title:`Policy decision: ${policy}`,status:"completed",detail:request.tool});
      if(policy==="deny"){steps.push({id:makeId("step"),kind:"tool",title:request.tool,status:"blocked",detail:"Permission not granted by the skill manifest."});return{id:runId,skill:skill.manifest.name,message,status:"failed",response:`${decision.response} The requested tool was blocked by policy.`,steps,toolRequest:request,policyDecision:policy,model:modelName,usage}}
      if(policy==="approval_required"){steps.push({id:makeId("step"),kind:"approval",title:`Approval required for ${request.tool}`,status:"pending",detail:"No external action has been executed."});return{id:runId,skill:skill.manifest.name,message,status:"waiting_approval",response:decision.response,steps,toolRequest:request,policyDecision:policy,model:modelName,usage}}
      const result=await this.executor.execute(request);steps.push({id:makeId("step"),kind:"tool",title:request.tool,status:result.ok?"completed":"blocked",detail:JSON.stringify(result.output)});
      if(!result.ok)return{id:runId,skill:skill.manifest.name,message,status:"failed",response:`Tool ${request.tool} failed.`,steps,toolRequest:request,policyDecision:policy,model:modelName,usage};
      history.push({tool:request.tool,input:request.input,output:result.output});
    }
    throw new Error("Unreachable agent runtime state");
  }
}
