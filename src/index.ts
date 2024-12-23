import { Annotation, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { Command } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { StateGraph } from "@langchain/langgraph";
import dotenv from 'dotenv';

dotenv.config();

const StateAnnotation = Annotation.Root({
    customerInquiry: Annotation<string>({
        value: (_prev, newValue) => newValue,
        default: () => "",
    }),
    route: Annotation<string>({
        value: (_prev, newValue) => newValue,
        default: () => "",
    })
});

const model = new ChatOpenAI({
    modelName: "gpt-4o-mini"
});

const routeUserRequest = async (state: typeof StateAnnotation.State) => {
    const response = await model.withStructuredOutput<{ route: "quotation" | "refund" }>({
        schema: {
            type: "object",
            properties: {
                route: { type: "string", enum: ["quotation", "refund"] }
            },
            required: ["route"]
        }
    }).invoke([
        new SystemMessage('Please categorize the user request'),        
        new HumanMessage(state.customerInquiry)
    ]);

    const routeToFunctionName = {
        "quotation": "quotationAgent",
        "refund": "refundAgent"
    };

    return new Command({
        update: {
            route: response.route
        },
        goto: routeToFunctionName[response.route],
    });
};

const quotationAgent = (state) => {
    return {};
};

const refundAgent = (state) => {
    return {};
};

const graph = new StateGraph(StateAnnotation)
    .addNode("routeUserRequest", routeUserRequest, { ends: ["quotationAgent", "refundAgent"] })
    .addNode("quotationAgent", quotationAgent)
    .addNode("refundAgent", refundAgent)
    .addEdge(START, "routeUserRequest")
    .compile();


async function main() {
  try {
    await graph.invoke({ customerInquiry: 'Hi, I need refund' });
    console.log("Done");
  } catch (error) {
    console.error("Error in main function:", error);
  }
}

main();
