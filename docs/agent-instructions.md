# How to write/edit requirements documents for the smtt functions

> Agent instructions to write/edit the smtt requirements documents. 
> These are `smtt.<function>.<aspect>.md` files, e.g. 
> `smtt.generate.features.md`

- Do not refer to carrier application (i.e. Malerien) specific examples for 
  the state machine aspects (like state names, attribute names, etc.) 
- Use REQ-### for the requirement numbers and keep them unique across all smtt
  documents.
- Use a concise to the point description of the requirement as such. 
  Add a rationale section (if important/not obvious) and remarks section with
  further explanations and examples, depending on the complexity of the 
  requirement.
- Use format: 
  ```markdown
  - REQ-###: <description>
    - Rationale: <rationale>
    - Remarks: <remarks>
      - Example1: <example> 
      ...
  ```
- Do not nest requirements. To group requirements use (sub)sections about its
  topic.
