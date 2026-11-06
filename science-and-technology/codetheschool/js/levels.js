/* Code to Class — three small Python lessons. */
(function (root) {
  const LEVELS = [
    {
      id: "first-bell",
      number: 1,
      chapter: "The School Run",
      chapterNumber: 1,
      title: "First Bell",
      field: "Choa Chu Kang Ave 1",
      concept: "Commands",
      intro:
        "You are walking to school for the first time. The school is straight down Choa Chu Kang Ave 1, five blocks away.",
      conceptDescription:
        "Commands are instructions. You follows them from top to bottom, one line at a time. Every command needs a pair of parentheses.",
      conceptSnippet: "move_forward()",
      hint:
        "The school is to the east. Call move_forward() five times and you will walk straight to the school gates.",
      starter:
        "# The first bell is ringing!\n# Hurry up to school.\n\nmove_forward()\n",
      size: { w: 6, h: 5 },
      start: { x: 0, y: 2, dir: 1 },
      goal: { x: 5, y: 2 },
      path: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2]],
      walls: [],
      solution: [
        "move_forward()",
        "move_forward()",
        "move_forward()",
        "move_forward()",
        "move_forward()"
      ].join("\n")
    },
    {
      id: "around-the-corner",
      number: 2,
      chapter: "The School Run",
      chapterNumber: 1,
      title: "Around the Corner",
      field: "Choa Chu Kang Park",
      concept: "Turns",
      intro:
        "The sidewalk bends north at the park. Turn yourself toward the next block, then face east again for the last stretch.",
      conceptDescription:
        "You move in the direction your character are facing. Turn first, then move. Left and right are relative to your character, not the screen.",
      conceptSnippet: "turn_left()\nturn_right()",
      hint:
        "Move east once, turn_left to face north, walk two blocks, then turn_right and walk four blocks east to school.",
      starter:
        "# The sidewalk turns north at the corner.\n\nmove_forward()\n",
      size: { w: 6, h: 5 },
      start: { x: 0, y: 4, dir: 1 },
      goal: { x: 5, y: 2 },
      path: [
        [0, 4], [1, 4], [1, 3], [1, 2],
        [2, 2], [3, 2], [4, 2], [5, 2]
      ],
      walls: [],
      solution: [
        "move_forward()",
        "turn_left()",
        "move_forward()",
        "move_forward()",
        "turn_right()",
        "move_forward()",
        "move_forward()",
        "move_forward()",
        "move_forward()"
      ].join("\n")
    },
    {
      id: "loop-to-the-bell",
      number: 3,
      chapter: "The School Run",
      chapterNumber: 1,
      title: "Loop to the Bell",
      field: "Choa Chu Kang Ave 2",
      concept: "For loops",
      intro:
        "One long, straight sidewalk. Instead of repeating the same command eight times, let a loop do the walking.",
      conceptDescription:
        "range(8) counts 0 through 7. The indented block beneath the loop runs once for each number—eight steps in all.",
      conceptSnippet: "for i in range(8):\n    move_forward()",
      hint:
        "Put move_forward() inside the for loop. range(8) repeats it eight times and takes you right to the school doors.",
      starter:
        "# One command can repeat your steps.\n# Replace pass with move_forward().\n\nfor i in range(8):\n    pass\n",
      size: { w: 9, h: 5 },
      start: { x: 0, y: 2, dir: 1 },
      goal: { x: 8, y: 2 },
      path: [
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
        [5, 2], [6, 2], [7, 2], [8, 2]
      ],
      walls: [],
      solution: "for i in range(8):\n    move_forward()"
    }
  ];

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { LEVELS };
  } else {
    root.LEVELS = LEVELS;
  }
})(typeof window !== "undefined" ? window : globalThis);
