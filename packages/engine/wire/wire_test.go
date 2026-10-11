package wire

import (
	"strings"
	"testing"

	"github.com/volodymyr-pavlov/go-game/packages/engine/game"
)

const validPosition = `{"board":[[1,0,0],[0,2,0],[0,0,0]],"toPlay":2,"koPoint":{"x":2,"y":2},"captures":{"1":3,"2":1},"consecutivePasses":1}`

func TestParsePositionReadsEveryField(t *testing.T) {
	p, err := ParsePosition(validPosition)
	if err != nil {
		t.Fatal(err)
	}
	if p.Board.At(game.Point{X: 0, Y: 0}) != game.Black || p.Board.At(game.Point{X: 1, Y: 1}) != game.White {
		t.Fatal("stones not placed")
	}
	if p.ToPlay != game.White || p.ConsecutivePasses != 1 {
		t.Fatalf("toPlay = %v, passes = %d", p.ToPlay, p.ConsecutivePasses)
	}
	if p.Ko != p.Board.Index(game.Point{X: 2, Y: 2}) {
		t.Fatalf("ko = %v", p.Ko)
	}
	if p.Captures.Black != 3 || p.Captures.White != 1 {
		t.Fatalf("captures = %v", p.Captures)
	}
}

func TestParsePositionRejectsBadInput(t *testing.T) {
	cases := map[string]struct{ raw, want string }{
		"not json":      {`{`, "not valid JSON"},
		"not square":    {`{"board":[[0,0],[0]],"toPlay":1}`, "not square"},
		"too small":     {`{"board":[[0]],"toPlay":1}`, "board size 1 is not between"},
		"unknown cell":  {`{"board":[[0,3],[0,0]],"toPlay":1}`, "cell 0,1: unknown value 3"},
		"toPlay empty":  {`{"board":[[0,0],[0,0]],"toPlay":0}`, "toPlay 0 is not a stone"},
		"ko off board":  {`{"board":[[0,0],[0,0]],"toPlay":1,"koPoint":{"x":5,"y":0}}`, "koPoint 5,0 is outside the board"},
		"negative pass": {`{"board":[[0,0],[0,0]],"toPlay":1,"consecutivePasses":-1}`, "consecutivePasses is not a whole number"},
		"not an object": {`[1,2]`, "not an object"},
		"cell not num":  {`{"board":[[0,"x"],[0,0]],"toPlay":1}`, "cell 0,1: not an integer"},
		"ko not point":  {`{"board":[[0,0],[0,0]],"toPlay":1,"koPoint":5}`, "koPoint is not a point"},
		"bad capture":   {`{"board":[[0,0],[0,0]],"toPlay":1,"captures":{"1":-2}}`, "captures.1 is not a whole number"},
		"fraction cell": {`{"board":[[0,1.5],[0,0]],"toPlay":1}`, "cell 0,1: not an integer"},
		"captures list": {`{"board":[[0,0],[0,0]],"toPlay":1,"captures":[0,4,5]}`, "captures is not an object"},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := ParsePosition(c.raw)
			if err == nil || !strings.Contains(err.Error(), c.want) {
				t.Fatalf("err = %v, want %q", err, c.want)
			}
		})
	}
}

func TestParsePositionDefaultsOptionalFields(t *testing.T) {
	p, err := ParsePosition(`{"board":[[0,0],[0,0]],"toPlay":1,"unknown":true}`)
	if err != nil {
		t.Fatal(err)
	}
	if p.Ko != game.NoKo || p.ConsecutivePasses != 0 || p.Captures != (game.Captures{}) {
		t.Fatalf("position = %+v", p)
	}
}

func TestToResponseEncodesPassAsNullMove(t *testing.T) {
	pass := ToJSON(ToResponse(game.Result{Move: game.PassMove(), WinRate: 0.5, Visits: 7}))
	if !strings.Contains(pass, `"move":null`) {
		t.Fatalf("pass = %s", pass)
	}
	point := ToJSON(ToResponse(game.Result{Move: game.PointMove(game.Point{X: 1, Y: 2})}))
	if !strings.Contains(point, `"move":{"x":1,"y":2}`) {
		t.Fatalf("point = %s", point)
	}
}

func TestClampPlayoutsKeepsRequestsInRange(t *testing.T) {
	cases := map[int]int{-5: MinPlayouts, 0: MinPlayouts, 500: 500, MaxPlayouts + 1: MaxPlayouts}
	for in, want := range cases {
		if got := ClampPlayouts(in); got != want {
			t.Errorf("ClampPlayouts(%d) = %d, want %d", in, got, want)
		}
	}
}

func TestErrorJSONKeepsTheMessageAsIs(t *testing.T) {
	if got := ErrorJSON(`say "no"`); got != `{"error":"say \"no\""}` {
		t.Fatalf("ErrorJSON = %s", got)
	}
}
