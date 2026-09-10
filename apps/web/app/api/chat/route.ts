import { getControlPlaneStore } from "@skillhydra/db";
import { resolveSkill } from "@skillhydra/skill-kit";
import { AgentRuntime, createConfiguredAgentModel } from "@skillhydra/runtime";
import { createConfiguredSandboxExecutor } from "@skillhydra/sandbox";
import { getPrincipal, jsonError } from "../../../lib/auth";
import { organizationForConversation, requireOrganizationRole } from "../../../lib/rbac";

export const runtime="nodejs";
export async function POST(request:Request){
  try{
    const principal=getPrincipal(request);const body=await request.json() as {message?:string;source?:string;conversationId?:string};
    if(!body.message?.trim())return Response.json({error:"A message is required"},{status:400});
    const store=getControlPlaneStore();let persistence:{organizationId:string;conversationId:string}|undefined;
    if(body.conversationId){const context=await organizationForConversation(store,body.conversationId);await requireOrganizationRole(store,context.organizationId,principal.userId,"member");persistence={organizationId:context.organizationId,conversationId:body.conversationId};await store.createMessage({conversationId:body.conversationId,role:"user",content:body.message.trim()})}
    const skill=await resolveSkill(body.source??"tank:@uriva/p2b-coder");const executor=await createConfiguredSandboxExecutor(skill.bundle);const agentRuntime=new AgentRuntime(createConfiguredAgentModel(),executor);const run=await agentRuntime.runTurn(skill.bundle,body.message);
    let persistedRunId:string|undefined;let approvalId:string|undefined;
    if(persistence){
      const storedRun=await store.createRun({conversationId:persistence.conversationId,status:run.status,model:run.model??null,inputTokens:run.usage?.inputTokens??0,outputTokens:run.usage?.outputTokens??0,estimatedCostUsd:run.usage?.estimatedCostUsd??0,completedAt:run.status==="completed"?new Date().toISOString():null});persistedRunId=storedRun.id;
      for(const step of run.steps)await store.createRunStep({runId:storedRun.id,kind:step.kind,status:step.status,payload:{runtimeStepId:step.id,title:step.title,detail:step.detail??null,tool:run.toolRequest?.tool??null,policyDecision:run.policyDecision??null,model:run.model??null}});
      if(run.status==="waiting_approval"&&run.toolRequest){const approval=await store.createApproval({runId:storedRun.id,toolName:run.toolRequest.tool,request:run.toolRequest.input});approvalId=approval.id}
      await store.createMessage({conversationId:persistence.conversationId,role:"assistant",content:run.response});
      await store.appendAuditEvent({organizationId:persistence.organizationId,actorId:principal.userId,action:"agent.run",resourceType:"run",resourceId:storedRun.id,metadata:{status:run.status,skill:skill.bundle.manifest.name,tool:run.toolRequest?.tool??null,policyDecision:run.policyDecision??null,model:run.model??null,inputTokens:run.usage?.inputTokens??0,outputTokens:run.usage?.outputTokens??0,estimatedCostUsd:run.usage?.estimatedCostUsd??0,sandboxProvider:process.env.SANDBOX_PROVIDER??"mock"}});
    }
    return Response.json({run,persistedRunId,approvalId});
  }catch(error){return jsonError(error)}
}
